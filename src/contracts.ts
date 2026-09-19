// Deployed PaymentGate on Base Sepolia (M1).
export const PAYMENT_GATE = "0x93F37c9af6b4dB4c51DD3CD1a742a4D9AdC878Ca" as const;

// Minimal ABI. Just what the frontend needs: read the price, pay for a scan,
// and read the emitted event.
export const PAYMENT_GATE_ABI = [
  {
    type: "function",
    name: "scanPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "purchaseScan",
    stateMutability: "payable",
    inputs: [{ name: "target", type: "address" }],
    outputs: [{ name: "paymentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "passPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "purchasePass",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "hasActivePass",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "ScanPurchased",
    inputs: [
      { name: "paymentId", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
