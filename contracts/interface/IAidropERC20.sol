// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

interface IAirdropERC20 {
    /**
     * @notice Creates a new campaign.
     * @dev Only the admin can create a campaign.
     * @dev You can create multiple campaigns with one token.
     *
     * @param _token The address of the token to be airdropped.
     * @return _campaignId The id of the campaign.
     */
    function createCampaign(
        address _token
    ) external returns (uint256 _campaignId);

    /**
     * @notice Adds recipients to a campaign.
     *
     * @dev Only the admin can add recipients to a campaign.
     * @dev Sizes of the arrays must be the same.
     *
     * @param _campaignId The id of the campaign.
     * @param _recipients The addresses of the recipients.
     * @param _amounts The amounts of tokens to be airdropped to the recipients.
     */
    function addRecipients(
        uint256 _campaignId,
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external;

    /**
     * @notice Changes the allocation of a recipient.
     * @dev Only the admin can change the allocation of a recipient.
     * @dev The amount must be greater than 0.
     *
     * @param _campaignId The id of the campaign.
     * @param _recipient The address of the recipient.
     * @param _amount The new amount of tokens to be airdropped to the recipient.
     */
    function changeUserAllocation(
        uint256 _campaignId,
        address _recipient,
        uint256 _amount
    ) external;

    /**
     * @notice Finalizes a campaign.
     * @dev Only the admin can finalize a campaign.
     * @dev Admin must have enough funds to finalize the campaign and give approval to the contract beforehand.
     *
     * @param _campaignId The id of the campaign.
     * @param _vestingStart The start time of the vesting.
     * @param _vestingDuration The duration of the vesting.
     */
    function finalizeCampaign(
        uint256 _campaignId,
        uint256 _vestingStart,
        uint256 _vestingDuration
    ) external;

    /**
     * @notice Claims airdrop tokens.
     *
     * @param _campaignId The id of the campaign.
     */
    function claim(uint256 _campaignId) external;

    /**
     * @notice Pauses the contract.
     *
     * @dev Only the admin can pause the contract.
     */
    function pause() external;

    /**
     * @notice Unpauses the contract.
     *
     * @dev Only the admin can unpause the contract.
     */
    function unpause() external;

    /**
     * @notice Returns the claimable amount for a recipient.
     *
     * @param _campaignId The id of the campaign.
     * @param _recipient The address of the recipient.
     *
     * @return The claimable amount.
     */
    function getClaimableAmount(
        uint256 _campaignId,
        address _recipient
    ) external view returns (uint256);

    /**
     * @notice Returns the next campaign id.
     *
     * @return The next campaign id.
     */
    function getNextCampaignId() external view returns (uint256);

    /**
     * @notice Returns the token of a campaign.
     *
     * @param _campaignId The id of the campaign.
     *
     * @return token The token of the campaign.
     */
    function getCampaignToken(
        uint256 _campaignId
    ) external view returns (address token);

    /**
     * @notice Returns the vesting start of a campaign.
     *
     * @param _campaignId The id of the campaign.
     *
     * @return vestingStart The vesting start of the campaign.
     */
    function getCampaignVestingStart(
        uint256 _campaignId
    ) external view returns (uint256 vestingStart);

    /**
     * @notice Returns the vesting duration of a campaign.
     *
     * @param _campaignId The id of the campaign.
     *
     * @return vestingDuration The vesting duration of the campaign.
     */
    function getCampaignVestingDuration(
        uint256 _campaignId
    ) external view returns (uint256 vestingDuration);

    /**
     * @notice Returns if a campaign is finalized.
     *
     * @param _campaignId The id of the campaign.
     *
     * @return finalized The finalized status of the campaign.
     */
    function getCampaignFinalized(
        uint256 _campaignId
    ) external view returns (bool finalized);

    /**
     * @notice Returns the total amount of a campaign.
     *
     * @param _campaignId The id of the campaign.
     *
     * @return totalAmount The total amount of the campaign.
     */
    function getCampaignTotalAmount(
        uint256 _campaignId
    ) external view returns (uint256 totalAmount);

    /**
     * @notice Returns the recipient info of a campaign.
     *
     * @param _campaignId The id of the campaign.
     * @param _user The address of the recipient.
     *
     * @return totalAllocation The total allocation of the recipient.
     * @return claimed The claimed amount of the recipient.
     */
    function getCampaignRecipientInfo(
        uint256 _campaignId,
        address _user
    ) external view returns (uint256 totalAllocation, uint256 claimed);

    /**
     * @notice Withdraws unclaimed tokens from a campaign after the vesting period has ended.
     *
     * @dev Only the admin can withdraw unclaimed tokens.
     * @dev The campaign must be finalized.
     * @dev The vesting period must have ended.
     *
     * @param _campaignId The id of the campaign.
     * @param _to The address to send the unclaimed tokens to.
     */
    function withdrawUnclaimedTokens(uint256 _campaignId, address _to) external;

    /**
     * @notice Updates vesting parameters for a campaign.
     * @dev Only the admin can update vesting parameters.
     * @dev The campaign must be finalized.
     * @dev The new vesting start must be in the future and within the maximum delay.
     *
     * @param _campaignId The id of the campaign.
     * @param _newVestingStart The new vesting start time.
     * @param _newVestingDuration The new vesting duration.
     */
    function updateVestingParameters(
        uint256 _campaignId,
        uint256 _newVestingStart,
        uint256 _newVestingDuration
    ) external;

    /**
     * @notice Sets the maximum vesting start delay.
     * @param _newMaxVestingStartDelay The new maximum vesting start delay.
     */
    function setMaxVestingStartDelay(uint256 _newMaxVestingStartDelay) external;

    /**
     * @notice Returns the maximum vesting start delay.
     *
     * @return The maximum vesting start delay.
     */
    function getMaxVestingStartDelay() external view returns (uint256);

    /**
     * @notice Returns the unclaimed amount of a campaign.
     *
     * @param _campaignId The id of the campaign.
     *
     * @return unclaimedAmount The unclaimed amount of the campaign.
     */
    function getCampaignUnclaimedAmount(
        uint256 _campaignId
    ) external view returns (uint256 unclaimedAmount);
}
