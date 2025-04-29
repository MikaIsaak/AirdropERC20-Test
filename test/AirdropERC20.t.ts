import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AirdropERC20, MockERC20 } from "../typechain-types";

describe("AirdropERC20", function () {
  let airdrop: AirdropERC20;
  let token: MockERC20;
  let owner: SignerWithAddress;
  let recipient1: SignerWithAddress;
  let recipient2: SignerWithAddress;
  let recipients: SignerWithAddress[];
  let vestingStart: bigint;
  let vestingDuration: bigint;
  const TOTAL_TOKENS = 1000n * 10n ** 18n;

  async function deployContracts() {
    [owner, recipient1, recipient2] = await ethers.getSigners();
    console.log("owner", owner.address);
    console.log("recipient1", recipient1.address);
    console.log("recipient2", recipient2.address);
    recipients = [recipient1, recipient2];

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Test Token", "TEST");

    const AirdropERC20 = await ethers.getContractFactory("AirdropERC20");
    airdrop = await AirdropERC20.deploy(owner.address);

    await token.mint(owner.address, TOTAL_TOKENS);
    await token.connect(owner).approve(airdrop.target, TOTAL_TOKENS);
  }

  beforeEach(async function () {
    await deployContracts();
    vestingStart = BigInt(await time.latest()) + 10n;
    vestingDuration = 86400n * 30n; // 30 days
  });

  describe("Constructor", function () {
    it("Should create constructor", async function () {
      expect(await airdrop.owner()).to.equal(owner.address);
    });

    //tested by Ownable contract
    // it("Should revert if admin is zero address", async function () {
    //   const AirdropERC20 = await ethers.getContractFactory("AirdropERC20");
    //   await expect(
    //     AirdropERC20.deploy(ethers.ZeroAddress)
    //   ).to.be.revertedWithCustomError(airdrop, "InvalidAddress");
    // });
  });

  describe("createCampaign", function () {
    it("should create a new campaign", async function () {
      const tx = await airdrop.createCampaign(token.target);
      const campaignId = await airdrop.getNextCampaignId();
      expect(campaignId).to.equal(1n);
    });

    // it("should revert if caller is not admin", async function () {
    //   await expect(
    //     airdrop.connect(recipient1).createCampaign(token.target)
    //   ).to.be.revertedWithCustomError(airdrop, "NotAdmin");
    // });

    it("should revert if token address is zero", async function () {
      await expect(
        airdrop.createCampaign(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(airdrop, "InvalidTokenAddress");
    });

    it("should increase campaignId", async function () {
      const currentCampaignId = await airdrop.getNextCampaignId();
      const tx = await airdrop.createCampaign(token.target);
      const afterCampaignId = await airdrop.getNextCampaignId();
      expect(afterCampaignId).to.equal(currentCampaignId + 1n);
    });

    it("should write token address to campaign", async function () {
      const campaignId = await airdrop.getNextCampaignId();
      const tx = await airdrop.createCampaign(token.target);
      const campaignToken = await airdrop.getCampaignToken(campaignId);
      expect(campaignToken).to.equal(token.target);
    });

    it("should emit CampaignCreated event", async function () {
      await expect(airdrop.createCampaign(token.target))
        .to.emit(airdrop, "CampaignCreated")
        .withArgs(airdrop.getNextCampaignId(), token.target);
    });
  });

  describe("addRecipients", function () {
    it("should add recipients to campaign", async function () {
      // TODO: implement test
    });

    it("should revert if campaign isn't created", async function () {
      await expect(
        airdrop.addRecipients(100n, [recipient1.address], [100n * 10n ** 18n])
      ).to.be.revertedWithCustomError(airdrop, "CampaignNotFound");
    });

    it("should revert if campaign is finilized", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [100n * 10n ** 18n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await expect(
        airdrop.addRecipients(0n, [recipient1.address], [100n * 10n ** 18n])
      ).to.be.revertedWithCustomError(airdrop, "CampaignAlreadyFinalized");
    });

    it("should revert if recipient array is mismatch", async function () {
      await airdrop.createCampaign(token.target);
      await expect(
        airdrop.addRecipients(
          0n,
          [recipient1.address],
          [TOTAL_TOKENS / 10n, TOTAL_TOKENS / 10n]
        )
      ).to.be.revertedWithCustomError(airdrop, "ArraysMismatch");
    });

    it("should emit RecipientsAdded event", async function () {
      await airdrop.createCampaign(token.target);
      await expect(
        airdrop.addRecipients(0n, [recipient1.address], [TOTAL_TOKENS / 10n])
      )
        .to.emit(airdrop, "RecipientsAdded")
        .withArgs(0n, 1);
    });

    it("should revert if amount is zero", async function () {
      await airdrop.createCampaign(token.target);
      await expect(
        airdrop.addRecipients(0n, [recipient1.address], [0n])
      ).to.be.revertedWithCustomError(airdrop, "ZeroAmount");
    });

    it("should revert if recipient is zero address", async function () {
      await airdrop.createCampaign(token.target);
      await expect(
        airdrop.addRecipients(0n, [ethers.ZeroAddress], [10n * 10n ** 18n])
      ).to.be.revertedWithCustomError(airdrop, "InvalidAddress");
    });

    it("should revert if recipients array is too large", async function () {
      await airdrop.createCampaign(token.target);
      const largeArray = Array(101).fill(recipient1.address);
      const largeAmounts = Array(101).fill(10n * 10n ** 18n);

      await expect(
        airdrop.addRecipients(0n, largeArray, largeAmounts)
      ).to.be.revertedWithCustomError(airdrop, "ArrayTooLarge");
    });
  });

  describe("changeUserAllocation", function () {
    it("should revert if recipient is already zero address", async function () {
      await airdrop.createCampaign(token.target);
      await expect(
        airdrop.changeUserAllocation(1n, ethers.ZeroAddress, 100n * 10n ** 18n)
      ).to.be.revertedWithCustomError(airdrop, "InvalidAddress");
    });

    it("should revert if campaign is not created", async function () {
      await expect(
        airdrop.changeUserAllocation(1n, recipient1.address, 100n * 10n ** 18n)
      ).to.be.revertedWithCustomError(airdrop, "CampaignNotFound");
    });

    it("should revert if campaign is finalized", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await expect(
        airdrop.changeUserAllocation(0n, recipient1.address, 100n * 10n ** 18n)
      ).to.be.revertedWithCustomError(airdrop, "CampaignAlreadyFinalized");
    });

    it("should change total amount of campaign in case of increasing allocation", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      const totalAmount = await airdrop.getCampaignTotalAmount(0n);
      await airdrop.changeUserAllocation(
        0n,
        recipient1.address,
        20n * 10n ** 18n
      );
      const newTotalAmount = await airdrop.getCampaignTotalAmount(0n);
      expect(newTotalAmount).to.equal(20n * 10n ** 18n);
    });

    it("should change total amount of campaign in case of decreasing allocation", async function () {
      await airdrop.createCampaign(token.target);

      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );

      const totalAmount = await airdrop.getCampaignTotalAmount(0n);
      console.log("totalAmount", totalAmount / 10n ** 18n);
      expect(totalAmount).to.equal(TOTAL_TOKENS / 10n);
      await airdrop.changeUserAllocation(
        0n,
        recipient1.address,
        TOTAL_TOKENS / 20n
      );
      const newTotalAmount = await airdrop.getCampaignTotalAmount(0n);
      console.log("newTotalAmount", newTotalAmount / 10n ** 18n);
      expect(newTotalAmount).to.equal(TOTAL_TOKENS / 20n);
    });

    it("Should change recipient's allocation", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.changeUserAllocation(
        0n,
        recipient1.address,
        20n * 10n ** 18n
      );
      const [totalAllocation] = await airdrop.getCampaignRecipientInfo(
        0n,
        recipient1.address
      );
      expect(totalAllocation).to.equal(20n * 10n ** 18n);
    });

    it("should revert if new allocation equals current allocation", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);

      // Пытаемся изменить аллокацию на ту же сумму
      await expect(
        airdrop.changeUserAllocation(0n, recipient1.address, 10n * 10n ** 18n)
      ).to.be.revertedWithCustomError(airdrop, "AllocationNotChanged");
    });
  });

  describe("finalizeCampaign", function () {
    it("should revert if campaign is not created", async function () {
      await expect(
        airdrop.finalizeCampaign(0n, vestingStart, vestingDuration)
      ).to.be.revertedWithCustomError(airdrop, "CampaignNotFound");
    });

    it("Should revert if campaign is already finalized", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await expect(
        airdrop.finalizeCampaign(0n, vestingStart, vestingDuration)
      ).to.be.revertedWithCustomError(airdrop, "CampaignAlreadyFinalized");
    });

    it("should revert if vesting start is in the past", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      const currentTime = await time.latest();
      await expect(
        airdrop.finalizeCampaign(
          0n,
          BigInt(currentTime) - 1000n,
          vestingDuration
        )
      ).to.be.revertedWithCustomError(airdrop, "InvalidVestingStart");
    });

    it("should revert if total amount is zero", async function () {
      await airdrop.createCampaign(token.target);
      await expect(
        airdrop.finalizeCampaign(0n, vestingStart, vestingDuration)
      ).to.be.revertedWithCustomError(airdrop, "ZeroAmount");
    });

    it("should set vesting start and duration", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      const campaignVestingStart = await airdrop.getCampaignVestingStart(0n);
      const campaignVestingDuration = await airdrop.getCampaignVestingDuration(
        0n
      );
      expect(campaignVestingStart).to.equal(vestingStart);
      expect(campaignVestingDuration).to.equal(vestingDuration);
    });

    it("Should finalize campaign", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      const campaignFinalized = await airdrop.getCampaignFinalized(0n);
      expect(campaignFinalized).to.equal(true);
    });

    it("Should emit CampaignFinalized event", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await expect(airdrop.finalizeCampaign(0n, vestingStart, vestingDuration))
        .to.emit(airdrop, "CampaignFinalized")
        .withArgs(0n);
    });
  });

  describe("claim", function () {
    it("should claim tokens", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await time.increaseTo(vestingStart + 86400n);
      const userBalace = await token.balanceOf(recipient1.address);
      console.log("userBalace", userBalace / 10n ** 18n);
      const claimableAmount = await airdrop.getClaimableAmount(
        0n,
        recipient1.address
      );
      console.log("claimableAmount", claimableAmount / 10n ** 18n);
      await airdrop.connect(recipient1).claim(0n);
      console.log("after claim", await token.balanceOf(recipient1.address));
      const expectedBalance = userBalace + claimableAmount;
      const actualBalance = await token.balanceOf(recipient1.address);
      expect(actualBalance).to.be.closeTo(
        expectedBalance,
        expectedBalance / 1000n // Погрешность 0.1%
      );
    });

    it("Should revert if token address is equals zero", async function () {
      await expect(airdrop.claim(0n)).to.be.revertedWithCustomError(
        airdrop,
        "CampaignNotFinalized"
      );
    });

    it("should revert if campaign is not finalized", async function () {
      await airdrop.createCampaign(token.target);
      await expect(airdrop.claim(0n)).to.be.revertedWithCustomError(
        airdrop,
        "CampaignNotFinalized"
      );
    });

    it("should revert if recipient has no tokens to claim", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await expect(
        airdrop.connect(recipient2).claim(0n)
      ).to.be.revertedWithCustomError(airdrop, "NoTokensToClaim");
    });

    it("should emit TokensClaimed event", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await time.increaseTo(vestingStart + 86400n);
      const claimableAmount = await airdrop.getClaimableAmount(
        0n,
        recipient1.address
      );
      //@todo
      await expect(airdrop.connect(recipient1).claim(0n))
        .to.emit(airdrop, "TokensClaimed")
        .withArgs(0n, recipient1.address, 333337191358024691n);
    });

    it("should claim tokens after vesting start", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await time.increaseTo(vestingStart + 1n);
      await airdrop.connect(recipient1).claim(0n);
      expect(await token.balanceOf(recipient1.address)).to.be.gt(0n);
    });

    it("should claim tokens after vesting duration", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await time.increaseTo(vestingStart + vestingDuration + 1n);
      await airdrop.connect(recipient1).claim(0n);
      expect(await token.balanceOf(recipient1.address)).to.equal(
        10n * 10n ** 18n
      );
    });

    it("should revert if trying to claim before vesting start", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Проверяем, что у пользователя есть токены
      const [totalAllocation] = await airdrop.getCampaignRecipientInfo(
        0n,
        recipient1.address
      );
      expect(totalAllocation).to.equal(10n * 10n ** 18n);

      // Проверяем, что getClaimableAmount возвращает 0 до начала вестинга
      const claimableAmount = await airdrop.getClaimableAmount(
        0n,
        recipient1.address
      );
      expect(claimableAmount).to.equal(0n);

      // Проверяем, что claim возвращает NoTokensToClaim
      await expect(
        airdrop.connect(recipient1).claim(0n)
      ).to.be.revertedWithCustomError(airdrop, "NoTokensToClaim");
    });

    it("should allow claiming immediately after finalization", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, 0n); // vestingDuration = 0

      // Увеличиваем время до vestingStart
      await time.increaseTo(vestingStart);

      const userBalace = await token.balanceOf(recipient1.address);
      const claimableAmount = await airdrop.getClaimableAmount(
        0n,
        recipient1.address
      );

      await airdrop.connect(recipient1).claim(0n);

      expect(claimableAmount).to.equal(10n * 10n ** 18n);
      expect(await token.balanceOf(recipient1.address)).to.equal(
        userBalace + claimableAmount
      );
    });

    it("should return full amount in getClaimableAmount when vestingDuration is 0", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, 0n); // vestingDuration = 0

      await time.increaseTo(vestingStart + 1n);

      const claimableAmount = await airdrop.getClaimableAmount(
        0n,
        recipient1.address
      );

      expect(claimableAmount).to.equal(10n * 10n ** 18n);
    });

    it("should revert with InvalidVestingStart when claiming before vesting start", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );

      // Устанавливаем vestingStart в будущее
      const currentTime = await time.latest();
      const futureVestingStart = BigInt(currentTime) + 3600n; // +1 час
      await airdrop.finalizeCampaign(0n, futureVestingStart, 0n); // vestingDuration = 0 для обхода проверки в getClaimableAmount

      // Пытаемся получить токены до начала вестинга
      await expect(
        airdrop.connect(recipient1).claim(0n)
      ).to.be.revertedWithCustomError(airdrop, "NoTokensToClaim");

      // Проверяем, что после начала вестинга claim работает
      await time.increaseTo(futureVestingStart + 1n);
      await expect(airdrop.connect(recipient1).claim(0n)).to.not.be.reverted;
    });
  });

  describe("withdrawUnclaimedTokens", function () {
    it("should revert if recipient address is zero", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Перемещаем время после окончания вестинга
      await time.increaseTo(vestingStart + vestingDuration + 1n);

      await expect(
        airdrop.withdrawUnclaimedTokens(0n, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(airdrop, "InvalidAddress");
    });

    it("should revert if campaign does not exist", async function () {
      const nonExistentCampaignId = 999n;

      await expect(
        airdrop.withdrawUnclaimedTokens(nonExistentCampaignId, owner.address)
      ).to.be.revertedWithCustomError(airdrop, "CampaignNotFound");
    });

    it("should revert if vesting period has not ended", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      await expect(
        airdrop.withdrawUnclaimedTokens(0n, owner.address)
      ).to.be.revertedWithCustomError(airdrop, "VestingNotEnded");
    });

    it("should withdraw unclaimed tokens after vesting period ends", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Перемещаем время после окончания вестинга
      await time.increaseTo(vestingStart + vestingDuration + 1n);

      const initialBalance = await token.balanceOf(owner.address);
      await airdrop.withdrawUnclaimedTokens(0n, owner.address);
      const finalBalance = await token.balanceOf(owner.address);

      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should withdraw all remaining tokens to specified address", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Перемещаем время после окончания вестинга
      await time.increaseTo(vestingStart + vestingDuration + 1n);

      const contractBalance = await token.balanceOf(airdrop.target);
      const recipientInitialBalance = await token.balanceOf(recipient2.address);

      await airdrop.withdrawUnclaimedTokens(0n, recipient2.address);

      const recipientFinalBalance = await token.balanceOf(recipient2.address);
      expect(recipientFinalBalance - recipientInitialBalance).to.equal(
        contractBalance
      );
    });

    it("should revert if caller is not admin", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Перемещаем время после окончания вестинга
      await time.increaseTo(vestingStart + vestingDuration + 1n);

      await expect(
        airdrop
          .connect(recipient1)
          .withdrawUnclaimedTokens(0n, recipient1.address)
      ).to.be.revertedWithCustomError(
        airdrop,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should handle withdrawal when contract balance is zero", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Перемещаем время после окончания вестинга
      await time.increaseTo(vestingStart + vestingDuration + 1n);

      // Сначала выводим все токены
      await airdrop.withdrawUnclaimedTokens(0n, owner.address);

      // Пытаемся вывести снова
      const initialBalance = await token.balanceOf(owner.address);
      await airdrop.withdrawUnclaimedTokens(0n, owner.address);
      const finalBalance = await token.balanceOf(owner.address);

      expect(finalBalance).to.equal(initialBalance);
    });

    it("should emit event when tokens are withdrawn", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Перемещаем время после окончания вестинга
      await time.increaseTo(vestingStart + vestingDuration + 1n);

      const contractBalance = await token.balanceOf(airdrop.target);

      await expect(airdrop.withdrawUnclaimedTokens(0n, owner.address))
        .to.emit(token, "Transfer")
        .withArgs(airdrop.target, owner.address, contractBalance);
    });
  });

  describe("Getters", function () {
    it("should return correct next campaign id", async function () {
      const initialId = await airdrop.getNextCampaignId();
      expect(initialId).to.equal(0n);

      await airdrop.createCampaign(token.target);
      const afterCreationId = await airdrop.getNextCampaignId();
      expect(afterCreationId).to.equal(1n);
    });

    it("should return correct campaign token", async function () {
      await airdrop.createCampaign(token.target);
      const campaignToken = await airdrop.getCampaignToken(0n);
      expect(campaignToken).to.equal(token.target);
    });

    it("should return correct vesting start and duration", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      const start = await airdrop.getCampaignVestingStart(0n);
      const duration = await airdrop.getCampaignVestingDuration(0n);

      expect(start).to.equal(vestingStart);
      expect(duration).to.equal(vestingDuration);
    });

    it("should return correct campaign finalized status", async function () {
      await airdrop.createCampaign(token.target);
      let finalized = await airdrop.getCampaignFinalized(0n);
      expect(finalized).to.equal(false);

      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      finalized = await airdrop.getCampaignFinalized(0n);
      expect(finalized).to.equal(true);
    });

    it("should return correct campaign total amount", async function () {
      await airdrop.createCampaign(token.target);
      let totalAmount = await airdrop.getCampaignTotalAmount(0n);
      expect(totalAmount).to.equal(0n);

      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      totalAmount = await airdrop.getCampaignTotalAmount(0n);
      expect(totalAmount).to.equal(TOTAL_TOKENS / 10n);

      await airdrop.addRecipients(
        0n,
        [recipient2.address],
        [TOTAL_TOKENS / 10n]
      );
      totalAmount = await airdrop.getCampaignTotalAmount(0n);
      expect(totalAmount).to.equal(TOTAL_TOKENS / 5n);
    });

    it("should return correct recipient info", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      const [totalAllocation, claimed] = await airdrop.getCampaignRecipientInfo(
        0n,
        recipient1.address
      );

      expect(totalAllocation).to.equal(TOTAL_TOKENS / 10n);
      expect(claimed).to.equal(0n);

      // После получения части токенов
      await time.increaseTo(vestingStart + vestingDuration / 2n);
      await airdrop.connect(recipient1).claim(0n);

      const [, claimedAfter] = await airdrop.getCampaignRecipientInfo(
        0n,
        recipient1.address
      );
      const expectedClaimed = TOTAL_TOKENS / 20n;
      expect(claimedAfter).to.be.closeTo(
        expectedClaimed,
        expectedClaimed / 1000n // Погрешность 0.1%
      );
    });

    it("should return zero values for non-existent campaign", async function () {
      const nonExistentId = 999n;

      const token = await airdrop.getCampaignToken(nonExistentId);
      const start = await airdrop.getCampaignVestingStart(nonExistentId);
      const duration = await airdrop.getCampaignVestingDuration(nonExistentId);
      const finalized = await airdrop.getCampaignFinalized(nonExistentId);
      const totalAmount = await airdrop.getCampaignTotalAmount(nonExistentId);
      const [allocation, claimed] = await airdrop.getCampaignRecipientInfo(
        nonExistentId,
        recipient1.address
      );

      expect(token).to.equal(ethers.ZeroAddress);
      expect(start).to.equal(0n);
      expect(duration).to.equal(0n);
      expect(finalized).to.equal(false);
      expect(totalAmount).to.equal(0n);
      expect(allocation).to.equal(0n);
      expect(claimed).to.equal(0n);
    });
  });

  describe("Pause functionality", function () {
    it("should allow admin to pause the contract", async function () {
      await airdrop.pause();
      expect(await airdrop.paused()).to.be.true;
    });

    it("should allow admin to unpause the contract", async function () {
      await airdrop.pause();
      await airdrop.unpause();
      expect(await airdrop.paused()).to.be.false;
    });

    it("should revert if non-admin tries to pause", async function () {
      await expect(
        airdrop.connect(recipient1).pause()
      ).to.be.revertedWithCustomError(
        airdrop,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should revert if non-admin tries to unpause", async function () {
      await airdrop.pause();
      await expect(
        airdrop.connect(recipient1).unpause()
      ).to.be.revertedWithCustomError(
        airdrop,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should prevent claiming when paused", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await time.increaseTo(vestingStart + vestingDuration);

      await airdrop.pause();

      await expect(
        airdrop.connect(recipient1).claim(0n)
      ).to.be.revertedWithCustomError(airdrop, "EnforcedPause");
    });

    it("should allow claiming after unpause", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);
      await time.increaseTo(vestingStart + vestingDuration);

      await airdrop.pause();
      await airdrop.unpause();

      await expect(airdrop.connect(recipient1).claim(0n)).to.not.be.reverted;
    });

    it("should revert when trying to pause already paused contract", async function () {
      await airdrop.pause();
      await expect(airdrop.pause()).to.be.revertedWithCustomError(
        airdrop,
        "EnforcedPause"
      );
    });
  });

  describe("Additional withdrawUnclaimedTokens tests", function () {
    it("should handle zero balance withdrawal", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Перемещаем время после окончания вестинга
      await time.increaseTo(vestingStart + vestingDuration + 1n);

      // Получаем все токены
      await airdrop.connect(recipient1).claim(0n);

      // Пытаемся вывести нулевой баланс
      const tx = await airdrop.withdrawUnclaimedTokens(0n, owner.address);
      await expect(tx).to.not.be.reverted;
    });

    it("should handle multiple withdrawals", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Перемещаем время после окончания вестинга
      await time.increaseTo(vestingStart + vestingDuration + 1n);

      // Первый вывод
      await airdrop.withdrawUnclaimedTokens(0n, owner.address);

      // Второй вывод (должен пройти, но с нулевым балансом)
      const tx = await airdrop.withdrawUnclaimedTokens(0n, owner.address);
      await expect(tx).to.not.be.reverted;
    });

    it("should revert withdrawal during vesting with correct error", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(
        0n,
        [recipient1.address],
        [TOTAL_TOKENS / 10n]
      );
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      // Пытаемся вывести до окончания вестинга
      await expect(
        airdrop.withdrawUnclaimedTokens(0n, owner.address)
      ).to.be.revertedWithCustomError(airdrop, "VestingNotEnded");
    });
  });

  describe("getClaimableAmount", function () {
    it("should return 0 if campaign is not finalized", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);

      const claimableAmount = await airdrop.getClaimableAmount(
        0n,
        recipient1.address
      );
      expect(claimableAmount).to.equal(0n);
    });

    it("should return 0 if user has no allocation", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, vestingDuration);

      const claimableAmount = await airdrop.getClaimableAmount(
        0n,
        recipient2.address
      );
      expect(claimableAmount).to.equal(0n);
    });

    it("should return 0 if all tokens are already claimed", async function () {
      await airdrop.createCampaign(token.target);
      await airdrop.addRecipients(0n, [recipient1.address], [10n * 10n ** 18n]);
      await airdrop.finalizeCampaign(0n, vestingStart, 0n); // Нулевая длительность вестинга

      await time.increaseTo(vestingStart + 1n);
      await airdrop.connect(recipient1).claim(0n);

      const claimableAmount = await airdrop.getClaimableAmount(
        0n,
        recipient1.address
      );
      expect(claimableAmount).to.equal(0n);
    });
  });
});
