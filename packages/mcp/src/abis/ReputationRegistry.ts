export const reputationRegistryAbi = [
  {
    type: "function",
    name: "giveFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getSummary",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddresses", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
    ],
    outputs: [
      { name: "count", type: "uint256" },
      { name: "summaryValue", type: "int256" },
      { name: "summaryValueDecimals", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getClients",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "NewFeedback",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: false },
      { name: "value", type: "int128", indexed: false },
      { name: "valueDecimals", type: "uint8", indexed: false },
      { name: "tag1", type: "string", indexed: false },
      { name: "tag2", type: "string", indexed: false },
    ],
  },
] as const;
