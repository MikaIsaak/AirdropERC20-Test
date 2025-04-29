import { ethers } from "hardhat";
import { AirdropERC20, MockERC20 } from "../typechain-types";
import { deployAirdropERC20 } from "./utils/deploy";
import { deployMockERC20 } from "./utils/deployMockERC20";
import { validateCSV, readRecipientsFromCSV } from "./utils/validation";
import fs from "fs";
import readline from "readline";
import path from "path";
import chalk from "chalk";

interface Batch {
  addresses: string[];
  amounts: string[];
}

interface CSVData {
  addresses: string[];
  amounts: string[];
}

async function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getValidatedInput(
  prompt: string,
  validate: (v: string) => string | null
): Promise<string> {
  while (true) {
    const value = await askQuestion(chalk.cyan.bold(prompt));
    const error = validate(value);
    if (!error) return value;
    console.log(chalk.red(`✗ Error: ${error}`));
    console.log();
  }
}

async function main() {
  try {
    const [admin] = await ethers.getSigners();
    console.log(chalk.green.bold("🚀 Airdrop Deployment Wizard"));
    console.log(chalk.green.bold("============================"));
    console.log();

    console.log(chalk.yellow("📋 Please provide the following details:"));
    const tokenName = await getValidatedInput(
      "  Token Name (e.g., MyToken): ",
      (v) =>
        !v
          ? "Token name cannot be empty"
          : v.length > 32
          ? "Token name too long"
          : null
    );
    const tokenSymbol = await getValidatedInput(
      "  Token Symbol (3-8 latin letters, e.g., MTK): ",
      (v) =>
        !/^[A-Za-z]{3,8}$/.test(v)
          ? "Token symbol must be 3-8 latin letters"
          : null
    );
    const vestingStartDelay = await getValidatedInput(
      "  Vesting Start Delay (seconds, e.g., 3600 for 1 hour): ",
      (v) =>
        !/^[0-9]+$/.test(v) || Number(v) <= 0
          ? "Must be a positive integer"
          : null
    );
    const vestingDuration = await getValidatedInput(
      "  Vesting Duration (seconds, e.g., 2592000 for 30 days): ",
      (v) =>
        !/^[0-9]+$/.test(v) || Number(v) <= 0
          ? "Must be a positive integer"
          : null
    );
    const batchSize = await getValidatedInput(
      "  Batch Size for Recipients (e.g., 50): ",
      (v) =>
        !/^[0-9]+$/.test(v) || Number(v) <= 0
          ? "Must be a positive integer"
          : null
    );
    const csvPath = await getValidatedInput(
      "  Path to CSV File (e.g., ./recipients.csv): ",
      (v) => {
        const fullPath = path.resolve(v);
        return !fs.existsSync(fullPath) ? `File not found: ${fullPath}` : null;
      }
    );
    console.log();

    console.log(chalk.blue("📄 Deploying Contracts..."));
    const airdrop = await deployAirdropERC20(admin.address);
    const airdropAddress = await airdrop.getAddress();
    console.log(
      chalk.green(
        `  ✓ AirdropERC20 deployed at: ${chalk.white(airdropAddress)}`
      )
    );
    console.log();

    console.log(chalk.blue(`📄 Deploying MockERC20 (${tokenSymbol})...`));
    const token = await deployMockERC20(tokenName, tokenSymbol);
    const tokenAddress = await token.getAddress();
    console.log(
      chalk.green(
        `  ✓ MockERC20 (${tokenSymbol}) deployed at: ${chalk.white(
          tokenAddress
        )}`
      )
    );
    console.log();

    const campaignId = await airdrop.getNextCampaignId();
    console.log(chalk.blue(`🔢 Campaign Details`));
    console.log(chalk.green(`  ✓ Campaign ID: ${chalk.white(campaignId)}`));
    console.log();

    console.log(chalk.blue("💰 Processing Tokens..."));
    await mintAndApprove(token, airdrop);
    console.log(chalk.green("  ✓ Tokens minted and approved"));
    console.log();

    console.log(chalk.blue("🏛️ Creating Campaign..."));
    await createCampaign(airdrop, tokenAddress);
    console.log(chalk.green("  ✓ Campaign created"));
    console.log();

    console.log(chalk.blue("📊 Processing CSV File..."));
    const { addresses, amounts } = await processCSVFile(csvPath);
    console.log(
      chalk.green(`  ✓ Processed ${chalk.white(addresses.length)} recipients`)
    );
    console.log();

    console.log(chalk.blue("👥 Adding Recipients..."));
    await addRecipients(
      airdrop,
      campaignId,
      addresses,
      amounts,
      Number(batchSize)
    );
    console.log(chalk.green("  ✓ All recipients added"));
    console.log();

    console.log(chalk.blue("🔒 Finalizing Campaign..."));
    const latestBlock = await ethers.provider.getBlock("latest");
    const currentBlockTime = BigInt(latestBlock?.timestamp || 0);
    const vestingStart = currentBlockTime + BigInt(vestingStartDelay);
    const vestingDurationBig = BigInt(vestingDuration);
    await finalizeCampaign(
      airdrop,
      campaignId,
      vestingStart,
      vestingDurationBig
    );
    console.log(chalk.green("  ✓ Campaign finalized"));
    console.log();

    console.log(
      chalk.green.bold("🎉 Airdrop Deployment Completed Successfully!")
    );
    console.log(
      chalk.green.bold("============================================")
    );
  } catch (error) {
    console.log();
    console.error(chalk.red("❌ Deployment Failed:"));
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
}

async function createCampaign(
  airdrop: AirdropERC20,
  tokenAddress: string
): Promise<void> {
  const tx = await airdrop.createCampaign(tokenAddress);
  const receipt = await tx.wait();
  if (receipt?.status !== 1) {
    throw new Error("Campaign creation transaction failed");
  }
}

async function addRecipients(
  airdrop: AirdropERC20,
  campaignId: bigint,
  addresses: string[],
  amounts: string[],
  batchSize: number
): Promise<void> {
  const normalizedAddresses = addresses.map((addr) => {
    const normalized = addr.toLowerCase();
    if (!ethers.isAddress(normalized)) {
      throw new Error(`Invalid address: ${addr}`);
    }
    return normalized;
  });

  const batches: Batch[] = [];
  for (let i = 0; i < normalizedAddresses.length; i += batchSize) {
    batches.push({
      addresses: normalizedAddresses.slice(i, i + batchSize),
      amounts: amounts.slice(i, i + batchSize),
    });
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(
      chalk.gray(
        `  • Processing batch ${i + 1}/${batches.length} (${
          batch.addresses.length
        } recipients)`
      )
    );

    const gasEstimate = await airdrop.addRecipients.estimateGas(
      campaignId,
      batch.addresses,
      batch.amounts
    );
    const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);

    const tx = await airdrop.addRecipients(
      campaignId,
      batch.addresses,
      batch.amounts,
      { gasLimit }
    );
    const receipt = await tx.wait();

    if (receipt?.status !== 1) {
      throw new Error(`Batch ${i + 1} transaction failed`);
    }
    console.log(chalk.green(`    ✓ Batch ${i + 1} processed`));
  }
}

async function processCSVFile(filePath: string): Promise<CSVData> {
  try {
    const recipients = readRecipientsFromCSV(filePath);
    let updated = false;

    for (const recipient of recipients) {
      const lower = recipient.address.toLowerCase();
      if (recipient.address !== lower) {
        recipient.address = lower;
        updated = true;
      }
    }

    if (updated) {
      const header = "address,amount\n";
      const lines = recipients
        .map((r) => `${r.address},${r.amount}`)
        .join("\n");
      fs.writeFileSync(filePath, header + lines);
      console.log(chalk.gray("  • Updated CSV with normalized addresses"));
    }

    const validationResult = validateCSV(filePath);
    if (!validationResult.isValid) {
      throw new Error(
        `CSV validation errors:\n${validationResult.errors.join("\n")}`
      );
    }

    return {
      addresses: recipients.map((r) => r.address),
      amounts: recipients.map((r) => r.amount),
    };
  } catch (error) {
    console.error(chalk.red("  ✗ Error processing CSV:"));
    throw error;
  }
}

async function finalizeCampaign(
  airdrop: AirdropERC20,
  campaignId: bigint,
  vestingStart: bigint,
  vestingDuration: bigint
): Promise<void> {
  const tx = await airdrop.finalizeCampaign(
    campaignId,
    vestingStart,
    vestingDuration
  );
  const receipt = await tx.wait();
  if (receipt?.status !== 1) {
    throw new Error("Campaign finalization failed");
  }
}

async function mintAndApprove(
  token: MockERC20,
  airdrop: AirdropERC20
): Promise<void> {
  const maxUint256 = ethers.MaxUint256;
  const airdropAddress = await airdrop.getAddress();
  const owner = await airdrop.owner();

  console.log(chalk.gray(`  • Minting tokens to ${owner}...`));
  const mintTx = await token.mint(owner, maxUint256);
  const mintReceipt = await mintTx.wait();
  if (mintReceipt?.status !== 1) {
    throw new Error("Token minting failed");
  }
  console.log(chalk.green(`    ✓ Minted ${maxUint256.toString()} tokens`));

  console.log(chalk.gray(`  • Approving tokens for ${airdropAddress}...`));
  const approveTx = await token.approve(airdropAddress, maxUint256);
  const approveReceipt = await approveTx.wait();
  if (approveReceipt?.status !== 1) {
    throw new Error("Token approval failed");
  }
  console.log(chalk.green("    ✓ Approval completed"));
}

main();
