import { BigInt } from "@graphprotocol/graph-ts";
import {
  ValidationRequested,
  ValidationResponded,
} from "../../generated/templates/ValidationRegistry/ValidationRegistry";
import { ValidationRequest } from "../../generated/schema";

export function handleValidationRequested(event: ValidationRequested): void {
  let id = event.params.requestHash.toHexString();
  let req = new ValidationRequest(id);
  req.requestHash = event.params.requestHash;
  req.agent = event.params.agentId.toString();
  req.validatorAddress = event.params.validatorAddress;
  req.requestURI = event.params.requestURI;
  req.createdAt = event.block.timestamp;
  req.save();
}

export function handleValidationResponded(event: ValidationResponded): void {
  let id = event.params.requestHash.toHexString();
  let req = ValidationRequest.load(id);
  if (req != null) {
    req.response = event.params.response;
    req.responseTag = event.params.tag;
    req.respondedAt = event.block.timestamp;
    req.save();
  }
}
