import { BigInt } from "@graphprotocol/graph-ts";
import {
  NewFeedback,
  FeedbackRevoked,
  ResponseAppended,
} from "../../generated/ReputationRegistry/ReputationRegistry";
import { Feedback, FeedbackResponse } from "../../generated/schema";

function feedbackId(agentId: BigInt, clientAddress: string, feedbackIndex: BigInt): string {
  return agentId.toString() + "-" + clientAddress + "-" + feedbackIndex.toString();
}

export function handleNewFeedback(event: NewFeedback): void {
  let id = feedbackId(event.params.agentId, event.params.clientAddress.toHexString(), event.params.feedbackIndex);
  let fb = new Feedback(id);
  fb.agent = event.params.agentId.toString();
  fb.clientAddress = event.params.clientAddress;
  fb.feedbackIndex = event.params.feedbackIndex;
  fb.value = event.params.value;
  fb.valueDecimals = event.params.valueDecimals;
  fb.tag1 = event.params.tag1;
  fb.tag2 = event.params.tag2;
  fb.isRevoked = false;
  fb.createdAt = event.block.timestamp;
  fb.save();
}

export function handleFeedbackRevoked(event: FeedbackRevoked): void {
  let id = feedbackId(event.params.agentId, event.params.clientAddress.toHexString(), event.params.feedbackIndex);
  let fb = Feedback.load(id);
  if (fb != null) {
    fb.isRevoked = true;
    fb.save();
  }
}

export function handleResponseAppended(event: ResponseAppended): void {
  let fbId = feedbackId(event.params.agentId, event.params.clientAddress.toHexString(), event.params.feedbackIndex);
  let id = fbId + "-resp-" + event.block.timestamp.toString();
  let resp = new FeedbackResponse(id);
  resp.feedback = fbId;
  resp.createdAt = event.block.timestamp;
  resp.save();
}
