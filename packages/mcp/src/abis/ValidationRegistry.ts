export const validationRegistryAbi = [
  {
    type: "function",
    name: "validationRequest",
    inputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "requestURI", type: "string" },
      { name: "requestHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getValidationStatus",
    inputs: [{ name: "requestHash", type: "bytes32" }],
    outputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "response", type: "uint8" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
      { name: "lastUpdate", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ValidationRequested",
    inputs: [
      { name: "requestHash", type: "bytes32", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "validatorAddress", type: "address", indexed: true },
      { name: "requestURI", type: "string", indexed: false },
    ],
  },
] as const;
