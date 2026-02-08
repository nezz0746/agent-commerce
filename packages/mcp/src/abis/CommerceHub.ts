export const commerceHubAbi = [
  {
    type: "function",
    name: "createShop",
    inputs: [
      { name: "name", type: "string" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "shop", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getShops",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isShop",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "shopCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "protocolFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ShopCreated",
    inputs: [
      { name: "shop", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
    ],
    anonymous: false,
  },
] as const;
