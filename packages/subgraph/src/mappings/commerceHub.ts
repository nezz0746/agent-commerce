import { BigInt } from "@graphprotocol/graph-ts";
import { ShopCreated, ProtocolFeeUpdated } from "../../generated/CommerceHub/CommerceHub";
import { Shop as ShopTemplate } from "../../generated/templates";
import { Protocol, Shop } from "../../generated/schema";

const PROTOCOL_ID = "protocol";

function getOrCreateProtocol(hubAddress: string): Protocol {
  let protocol = Protocol.load(PROTOCOL_ID);
  if (protocol == null) {
    protocol = new Protocol(PROTOCOL_ID);
    protocol.hub = changetype<Bytes>(hubAddress);
    protocol.protocolFee = BigInt.fromI32(0);
    protocol.shopCount = BigInt.fromI32(0);
  }
  return protocol;
}

export function handleShopCreated(event: ShopCreated): void {
  let protocol = getOrCreateProtocol(event.address.toHexString());
  protocol.shopCount = protocol.shopCount.plus(BigInt.fromI32(1));
  protocol.save();

  let shop = new Shop(event.params.shop.toHexString());
  shop.address = event.params.shop;
  shop.owner = event.params.owner;
  shop.name = event.params.name;
  shop.metadataURI = event.params.metadataURI;
  shop.createdAt = event.block.timestamp;
  shop.protocol = PROTOCOL_ID;
  shop.save();

  // Start indexing the new shop contract
  ShopTemplate.create(event.params.shop);
}

export function handleProtocolFeeUpdated(event: ProtocolFeeUpdated): void {
  let protocol = getOrCreateProtocol(event.address.toHexString());
  protocol.protocolFee = event.params.newFee;
  protocol.save();
}
