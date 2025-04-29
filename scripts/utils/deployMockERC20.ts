import { ethers } from "hardhat";
import { MockERC20 } from "../../typechain-types";

export async function deployMockERC20(
  name: string,
  symbol: string
): Promise<MockERC20> {
  try {
    if (!name || name.trim() === "") {
      throw new Error("Token name cannot be empty");
    }
    if (!symbol || symbol.trim() === "") {
      throw new Error("Token symbol cannot be empty");
    }

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const mockERC20 = await MockERC20Factory.deploy(name, symbol);

    await mockERC20.waitForDeployment();

    const contractAddress = await mockERC20.getAddress();
    console.log(`MockERC20 ${symbol} deployed to: ${contractAddress}`);

    return mockERC20;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to deploy MockERC20: ${errorMessage}`);
    throw error;
  }
}
