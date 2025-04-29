import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const NUMBER_OF_ADDRESSES = 10;
const OUTPUT_CSV_PATH = path.resolve(
  `scripts/data/recipients_${NUMBER_OF_ADDRESSES}.csv`
);
const DEFAULT_AMOUNT = ethers.parseUnits("100", 18).toString();

async function generateAddresses() {
  try {
    console.log(
      `Generating ${NUMBER_OF_ADDRESSES} random Ethereum addresses...`
    );

    const recipients: { address: string; amount: string }[] = [];

    for (let i = 0; i < NUMBER_OF_ADDRESSES; i++) {
      const wallet = ethers.Wallet.createRandom();
      recipients.push({
        address: wallet.address,
        amount: DEFAULT_AMOUNT,
      });
      if ((i + 1) % 100 === 0) {
        console.log(`Generated ${i + 1} addresses`);
      }
    }

    const header = "address,amount\n";
    const csvContent = recipients
      .map((recipient) => `${recipient.address},${recipient.amount}`)
      .join("\n");

    fs.writeFileSync(OUTPUT_CSV_PATH, header + csvContent);
    console.log(`Saved ${NUMBER_OF_ADDRESSES} addresses to ${OUTPUT_CSV_PATH}`);
  } catch (error) {
    console.error("Error generating addresses:", error);
    process.exit(1);
  }
}

generateAddresses();
