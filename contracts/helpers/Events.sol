// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

event CampaignCreated(uint256 indexed campaignId, address indexed token);
event RecipientsAdded(uint256 indexed campaignId, uint256 count);
event CampaignFinalized(uint256 indexed campaignId);
event TokensClaimed(
        uint256 indexed campaignId,
        address indexed recipient,
        uint256 amount
    );
event AllocationChanged(uint256 indexed campaignId, address indexed recipient, uint256 newAmount);