// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeTransferLib} from "./libs/SafeTransferLib.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAirdropERC20} from "./interface/IAidropERC20.sol";
import "./helpers/Errors.sol";
import "./helpers/Events.sol";
import "./helpers/Roles.sol";

contract AirdropERC20 is
    IAirdropERC20,
    AccessControl,
    ReentrancyGuard,
    Pausable,
    Ownable
{
    using SafeTransferLib for ERC20;

    uint256 private nextCampaignId;
    uint256 private maxVestingStartDelay;

    struct Campaign {
        address token;
        uint256 vestingStart;
        uint256 vestingDuration;
        bool finalized;
        uint256 totalAmount;
        uint256 unclaimedAmount;
        mapping(address => uint256) totalAllocations;
        mapping(address => uint256) claimedAmounts;
    }

    mapping(uint256 campaignId => Campaign campaign) private campaigns;

    /**
     * @notice Constructor.
     * @param _admin The address of the admin.
     * @param _maxVestingStartDelay The maximum vesting start delay.
     */
    constructor(address _admin, uint256 _maxVestingStartDelay) Ownable(_admin) {
        if (_admin == address(0)) revert InvalidAddress();
        if (_maxVestingStartDelay == 0) revert InvalidMaxVestingStartDelay();

        maxVestingStartDelay = _maxVestingStartDelay;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function setMaxVestingStartDelay(
        uint256 _newMaxVestingStartDelay
    ) external onlyRole(ADMIN_ROLE) {
        if (_newMaxVestingStartDelay == 0) revert InvalidMaxVestingStartDelay();

        maxVestingStartDelay = _newMaxVestingStartDelay;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function createCampaign(
        address _token
    ) external onlyRole(ADMIN_ROLE) returns (uint256 _campaignId) {
        if (_token == address(0)) revert InvalidTokenAddress();
        uint256 campaignId = nextCampaignId++;

        campaigns[campaignId].token = _token;

        emit CampaignCreated(campaignId, _token);
        return campaignId;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function addRecipients(
        uint256 _campaignId,
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external onlyRole(ADMIN_ROLE) {
        Campaign storage campaign = campaigns[_campaignId];

        if (campaign.token == address(0)) revert CampaignNotFound();
        if (campaign.finalized) revert CampaignAlreadyFinalized();
        if (_recipients.length != _amounts.length) revert ArraysMismatch();

        uint256 arrayLength = _recipients.length;
        for (uint256 i = 0; i < arrayLength; i++) {
            if (_amounts[i] == 0) revert ZeroAmount();
            if (_recipients[i] == address(0)) revert InvalidAddress();

            campaign.totalAllocations[_recipients[i]] += _amounts[i];
            campaign.totalAmount += _amounts[i];
            campaign.unclaimedAmount += _amounts[i];
        }

        emit RecipientsAdded(_campaignId, arrayLength);
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function changeUserAllocation(
        uint256 campaignId,
        address recipient,
        uint256 amount
    ) external onlyRole(ADMIN_ROLE) {
        if (recipient == address(0)) revert InvalidAddress();

        Campaign storage campaign = campaigns[campaignId];

        if (campaign.token == address(0)) revert CampaignNotFound();
        if (campaign.finalized) revert CampaignAlreadyFinalized();
        if (campaign.totalAllocations[recipient] == amount)
            revert AllocationNotChanged();

        uint256 oldAllocation = campaign.totalAllocations[recipient];
        campaign.totalAmount = campaign.totalAmount - oldAllocation + amount;
        campaign.unclaimedAmount =
            campaign.unclaimedAmount -
            oldAllocation +
            amount;
        campaign.totalAllocations[recipient] = amount;

        emit AllocationChanged(campaignId, recipient, amount);
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function finalizeCampaign(
        uint256 _campaignId,
        uint256 _vestingStart,
        uint256 _vestingDuration
    ) external onlyRole(ADMIN_ROLE) {
        Campaign storage campaign = campaigns[_campaignId];

        if (campaign.token == address(0)) revert CampaignNotFound();
        if (campaign.finalized) revert CampaignAlreadyFinalized();
        if (_vestingStart < block.timestamp) revert InvalidVestingStart();
        if (_vestingStart > (block.timestamp + maxVestingStartDelay))
            revert VestingStartTooFar();
        if (campaign.totalAmount == 0) revert ZeroAmount();

        SafeTransferLib.safeTransferFrom(
            ERC20(campaign.token),
            msg.sender,
            address(this),
            campaign.totalAmount
        );

        campaign.vestingStart = _vestingStart;
        campaign.vestingDuration = _vestingDuration;
        campaign.finalized = true;

        emit CampaignFinalized(_campaignId);
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function updateVestingParameters(
        uint256 _campaignId,
        uint256 _newVestingStart,
        uint256 _newVestingDuration
    ) external onlyRole(ADMIN_ROLE) {
        Campaign storage campaign = campaigns[_campaignId];

        if (campaign.token == address(0)) revert CampaignNotFound();
        if (!campaign.finalized) revert CampaignNotFinalized();
        if (_newVestingStart < block.timestamp) revert InvalidVestingStart();
        if (_newVestingStart > block.timestamp + maxVestingStartDelay)
            revert VestingStartTooFar();

        campaign.vestingStart = _newVestingStart;
        campaign.vestingDuration = _newVestingDuration;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function claim(uint256 _campaignId) external nonReentrant whenNotPaused {
        Campaign storage campaign = campaigns[_campaignId];

        if (campaign.token == address(0) || !campaign.finalized)
            revert CampaignNotFinalized();

        if (campaign.totalAllocations[msg.sender] == 0)
            revert NoTokensToClaim();

        uint256 amount = getClaimableAmount(_campaignId, msg.sender);

        if (amount == 0) revert NoTokensToClaim();

        campaign.claimedAmounts[msg.sender] += amount;
        campaign.unclaimedAmount -= amount;

        SafeTransferLib.safeTransfer(ERC20(campaign.token), msg.sender, amount);

        emit TokensClaimed(_campaignId, msg.sender, amount);
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function withdrawUnclaimedTokens(
        uint256 _campaignId,
        address _to
    ) external onlyRole(ADMIN_ROLE) {
        if (_to == address(0)) revert InvalidAddress();

        Campaign storage campaign = campaigns[_campaignId];

        if (campaign.token == address(0)) revert CampaignNotFound();
        if (!campaign.finalized) revert CampaignNotFinalized();
        if (block.timestamp <= campaign.vestingStart + campaign.vestingDuration)
            revert VestingNotEnded();

        uint256 amount = campaign.unclaimedAmount;
        if (amount == 0) revert NoTokensToClaim();

        campaign.unclaimedAmount = 0;
        SafeTransferLib.safeTransfer(ERC20(campaign.token), _to, amount);
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    //   ____ _____ _____ _____ _____ ____  ____
    //  / ___| ____|_   _|_   _| ____|  _ \/ ___|
    // | |  _|  _|   | |   | | |  _| | |_) \___ \
    // | |_| | |___  | |   | | | |___|  _ < ___) |
    //  \____|_____| |_|   |_| |_____|_| \_\____/
    /**
     * @inheritdoc IAirdropERC20
     */
    function getClaimableAmount(
        uint256 _campaignId,
        address _recipient
    ) public view returns (uint256) {
        Campaign storage campaign = campaigns[_campaignId];

        uint256 totalAllocation = campaign.totalAllocations[_recipient];
        uint256 claimed = campaign.claimedAmounts[_recipient];

        if (!campaign.finalized) return 0;
        if (totalAllocation == 0) return 0;

        if (block.timestamp < campaign.vestingStart) return 0;

        uint256 elapsed = block.timestamp - campaign.vestingStart;
        uint256 vestingDuration = campaign.vestingDuration;

        if (vestingDuration == 0) {
            return totalAllocation - claimed;
        }

        uint256 totalVested;
        if (elapsed >= vestingDuration) {
            totalVested = totalAllocation;
        } else {
            totalVested = Math.mulDiv(
                totalAllocation,
                elapsed,
                vestingDuration,
                Math.Rounding.Floor
            );
        }
        return totalVested - claimed;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function getNextCampaignId() external view returns (uint256) {
        return nextCampaignId;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function getMaxVestingStartDelay() external view returns (uint256) {
        return maxVestingStartDelay;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function getCampaignToken(
        uint256 _campaignId
    ) external view returns (address token) {
        return campaigns[_campaignId].token;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function getCampaignVestingStart(
        uint256 _campaignId
    ) external view returns (uint256 vestingStart) {
        return campaigns[_campaignId].vestingStart;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function getCampaignVestingDuration(
        uint256 _campaignId
    ) external view returns (uint256 vestingDuration) {
        return campaigns[_campaignId].vestingDuration;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function getCampaignFinalized(
        uint256 _campaignId
    ) external view returns (bool finalized) {
        return campaigns[_campaignId].finalized;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function getCampaignTotalAmount(
        uint256 _campaignId
    ) external view returns (uint256 totalAmount) {
        return campaigns[_campaignId].totalAmount;
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function getCampaignRecipientInfo(
        uint256 _campaignId,
        address _user
    ) external view returns (uint256 totalAllocation, uint256 claimed) {
        Campaign storage campaign = campaigns[_campaignId];

        return (
            campaign.totalAllocations[_user],
            campaign.claimedAmounts[_user]
        );
    }

    /**
     * @inheritdoc IAirdropERC20
     */
    function getCampaignUnclaimedAmount(
        uint256 _campaignId
    ) external view returns (uint256 unclaimedAmount) {
        return campaigns[_campaignId].unclaimedAmount;
    }
}
