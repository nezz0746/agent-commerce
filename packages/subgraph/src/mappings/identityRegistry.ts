import { BigInt } from "@graphprotocol/graph-ts";
import { Registered, URIUpdated } from "../../generated/IdentityRegistry/IdentityRegistry";
import { Agent } from "../../generated/schema";

export function handleRegistered(event: Registered): void {
  let id = event.params.agentId.toString();
  let agent = new Agent(id);
  agent.agentId = event.params.agentId;
  agent.owner = event.params.owner;
  agent.agentURI = event.params.agentURI;
  agent.createdAt = event.block.timestamp;
  agent.save();
}

export function handleURIUpdated(event: URIUpdated): void {
  let id = event.params.agentId.toString();
  let agent = Agent.load(id);
  if (agent != null) {
    agent.agentURI = event.params.newURI;
    agent.save();
  }
}
