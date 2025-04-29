import { ethers } from "ethers";
import * as fs from "fs";

export interface RecipientData {
  address: string;
  amount: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

export function validateAmount(amount: string): boolean {
  try {
    const value = ethers.parseEther(amount);
    return value > 0n;
  } catch {
    return false;
  }
}

export function validateCSV(filePath: string): ValidationResult {
  const errors: string[] = [];
  let lineNumber = 1;

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      errors.push("CSV файл пуст");
      return { isValid: false, errors };
    }

    const header = lines[0].toLowerCase();
    if (!header.includes("address") || !header.includes("amount")) {
      errors.push("CSV должен содержать колонки 'address' и 'amount'");
    }

    for (let i = 1; i < lines.length; i++) {
      lineNumber = i + 1;
      const [address, amount] = lines[i].split(",").map((item) => item.trim());

      if (!validateAddress(address)) {
        errors.push(`Строка ${lineNumber}: Неверный формат адреса: ${address}`);
      }

      if (!validateAmount(amount)) {
        errors.push(`Строка ${lineNumber}: Неверный формат суммы: ${amount}`);
      }
    }
  } catch (error) {
    errors.push(
      `Ошибка при чтении файла: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function readRecipientsFromCSV(filePath: string): RecipientData[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  return lines.slice(1).map((line) => {
    const [address, amount] = line.split(",").map((item) => item.trim());
    return { address, amount };
  });
}

export function createBatches(
  recipients: RecipientData[],
  batchSize: number
): RecipientData[][] {
  const batches: RecipientData[][] = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }
  return batches;
}
