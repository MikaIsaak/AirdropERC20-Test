# ✨ Airdrop Smart Contract System

## 🚀 Overview

Airdrop Smart Contract System is a powerful, production-ready solution for managing multiple token distribution campaigns (airdrops) with advanced vesting, secure claiming, and full automation. The system is designed for scalability, security, and ease of use—empowering teams to run large-scale airdrops with confidence.

---

## 🌟 Key Features

- **Multi-Campaign Support:** Run several airdrop campaigns in parallel or sequentially, each with its own ERC-20 token.
- **Bulk Uploads:** Upload large recipient lists and allocations in gas-optimized batches via CSV.
- **Vesting Logic:** Set vesting periods and start times for each campaign; claimable amounts vest linearly.
- **Finalization:** Lock campaigns after upload; no further changes allowed post-finalization.
- **Secure Claiming:** Only eligible addresses can claim, and only once per campaign.
- **Admin Controls:** Only the contract owner can create, upload, and finalize campaigns.
- **Gas Optimization:** Batch uploads and efficient storage for large datasets.
- **Interactive CLI Tool:** Node.js CLI for campaign management, CSV validation, and progress tracking.

---

## 🛠️ Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Compile Smart Contracts

```bash
npx hardhat compile
```

### 3. Run Tests (Optional)

```bash
npx hardhat test
```

### 4. Prepare Your CSV File

- Format: `address,amount`
- Example:
  ```
  address,amount
  0xabc123...,100
  0xdef456...,250
  ...
  ```
- Place your file in `scripts/data/recipients.csv` or specify your own path during CLI prompts.

### 5. Launch the Airdrop CLI

```bash
npx hardhat run scripts/script.ts
```

You will be guided through:

- Token name and symbol
- Vesting start delay and duration (in seconds)
- Batch size for uploads
- Path to the CSV file

#### Example Session

```
🚀 Airdrop Deployment Wizard
============================

📋 Please provide the following details:
  Token Name (e.g., MyToken): ExampleToken
  Token Symbol (3-8 latin letters, e.g., EXM): EXM
  Vesting Start Delay (seconds, e.g., 3600 for 1 hour): 3600
  Vesting Duration (seconds, e.g., 2592000 for 30 days): 2592000
  Batch Size for Recipients (e.g., 50): 100
  Path to CSV File (e.g., ./recipients.csv): scripts/data/recipients.csv

... (deployment and upload progress logs)
```

---

## 📦 Project Structure

- `contracts/` — Solidity smart contracts
- `scripts/` — CLI tool, deployment, and helper scripts
- `scripts/data/` — Example and generated CSV files
- `test/` — Automated tests

---

## 🧩 Smart Contract Capabilities

### Campaign Creation

- Start a new campaign with a unique ID.
- Link each campaign to a specific ERC-20 token.

### Bulk Data Upload

- Upload recipient allocations in batches (address → token amount).
- Input via CSV file; each batch is a single transaction for gas efficiency.

### Finalize Campaign

- Set vesting period (in days) and optional vesting start time.
- Finalization locks the campaign and enables claiming.
- No further uploads or changes allowed after finalization.

### Claiming

- Only addresses included in the finalized campaign can claim.
- Claimable amount vests linearly over the vesting period.
- Each address can claim only once per campaign.

### Multi-Campaign Support

- Multiple campaigns can run in parallel or sequentially.
- Each campaign can distribute a different ERC-20 token.
- Addresses may participate in multiple campaigns with different allocations.

---

## 🔒 Security Considerations

- **Reentrancy Protection:** All claim and upload functions are protected against reentrancy.
- **Access Control:** Only the contract owner can create, upload, and finalize campaigns.
- **Double-Claim Prevention:** Each address can claim only once per campaign.
- **Gas Optimization:** Batch uploads and efficient storage for large recipient lists.

---

## 🧪 Example: Generating Test Addresses

A helper script is provided to generate random addresses for testing:

```bash
npx hardhat run scripts/generate-addresses.ts
```

This will create a CSV file with 1000 random addresses and default token amounts in `scripts/data/recipients_1000.csv`.
# AidropERC20
# AidropERC20
