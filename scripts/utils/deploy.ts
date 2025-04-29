import { ethers } from "hardhat";
import { AirdropERC20 } from "../../typechain-types";

const MAX_VESTING_START_DELAY = 86400n * 30n;
export async function deployAirdropERC20(
  adminAddress: string
): Promise<AirdropERC20> {
  try {
    if (
      !ethers.isAddress(adminAddress) ||
      adminAddress === ethers.ZeroAddress
    ) {
      throw new Error(`Invalid admin address: ${adminAddress}`);
    }

    const AirdropERC20Factory = await ethers.getContractFactory("AirdropERC20");
    const airdropERC20 = await AirdropERC20Factory.deploy(
      adminAddress,
      MAX_VESTING_START_DELAY
    );

    await airdropERC20.waitForDeployment();

    const contractAddress = await airdropERC20.getAddress();
    console.log(`AirdropERC20 deployed to: ${contractAddress}`);

    return airdropERC20;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to deploy AirdropERC20: ${errorMessage}`);
    throw error;
  }
}
