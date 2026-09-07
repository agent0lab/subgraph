import { Address, BigInt, Bytes, DataSourceContext, ethereum } from "@graphprotocol/graph-ts"
import { assert, beforeEach, clearStore, dataSourceMock, newMockEvent, test } from "matchstick-as/assembly/index"
import { Registered, URIUpdated } from "../generated/IdentityRegistry/IdentityRegistry"
import { NewFeedback } from "../generated/ReputationRegistry/ReputationRegistry"
import { Agent, Feedback } from "../generated/schema"
import { handleAgentRegistered, handleUriUpdated } from "../src/identity-registry"
import { handleNewFeedback } from "../src/reputation-registry"
import { parseRegistrationFile } from "../src/registration-file"
import { parseFeedbackFile } from "../src/feedback-file"

const CID = "bafkreicrr4o6wyhpyx7rqdz65glhy3pj6mpwxpspgduc4uyvlpdkonjk5u"
const URI = "ipfs://" + CID
const TX = "0x6cfdfdd7e87e8df5dd1b8b26aadcc79d59fad2df26e1064a8d38d5d09a73a203"
const OTHER_TX = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const OWNER = "0x0000000000000000000000000000000000000001"
const CLIENT = "0x0000000000000000000000000000000000000002"
const TIMESTAMP = 1700000000
const BLOCK = 10429684

// Matchstick 0.6 cannot represent the Int8/Timestamp values used by analytics.
// An unsupported network uses chain ID 0 and skips getOrCreateProtocol's
// analytics branch without changing production code. These tests cover file
// IDs, ownership and feedback counters, not timeseries or aggregation behavior.
beforeEach(() => {
  clearStore()
  dataSourceMock.setReturnValues(OWNER, "file-id-test", new DataSourceContext())
})

function setEventIdentity(event: ethereum.Event, tx: string, logIndex: i32, block: i32 = BLOCK): void {
  event.transaction.hash = Bytes.fromHexString(tx)
  event.logIndex = BigInt.fromI32(logIndex)
  event.block.number = BigInt.fromI32(block)
  event.block.timestamp = BigInt.fromI32(TIMESTAMP)
}

function registered(agentId: i32, logIndex: i32, uri: string = URI, tx: string = TX, block: i32 = BLOCK): Registered {
  let event = changetype<Registered>(newMockEvent())
  setEventIdentity(event, tx, logIndex, block)
  event.parameters = [
    new ethereum.EventParam("agentId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))),
    new ethereum.EventParam("agentURI", ethereum.Value.fromString(uri)),
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(Address.fromString(OWNER)))
  ]
  return event
}

function uriUpdated(agentId: i32, logIndex: i32): URIUpdated {
  let event = changetype<URIUpdated>(newMockEvent())
  setEventIdentity(event, TX, logIndex)
  event.parameters = [
    new ethereum.EventParam("agentId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))),
    new ethereum.EventParam("newURI", ethereum.Value.fromString(URI)),
    new ethereum.EventParam("updatedBy", ethereum.Value.fromAddress(Address.fromString(OWNER)))
  ]
  return event
}

function newFeedback(agentId: i32, feedbackIndex: i32, logIndex: i32, tx: string = TX, block: i32 = BLOCK): NewFeedback {
  let event = changetype<NewFeedback>(newMockEvent())
  setEventIdentity(event, tx, logIndex, block)
  event.parameters = [
    new ethereum.EventParam("agentId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(agentId))),
    new ethereum.EventParam("clientAddress", ethereum.Value.fromAddress(Address.fromString(CLIENT))),
    new ethereum.EventParam("feedbackIndex", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(feedbackIndex))),
    new ethereum.EventParam("value", ethereum.Value.fromSignedBigInt(BigInt.fromI32(875))),
    new ethereum.EventParam("valueDecimals", ethereum.Value.fromI32(2)),
    new ethereum.EventParam("indexedTag1", ethereum.Value.fromFixedBytes(Bytes.fromHexString(OTHER_TX))),
    new ethereum.EventParam("tag1", ethereum.Value.fromString("quality")),
    new ethereum.EventParam("tag2", ethereum.Value.fromString("")),
    new ethereum.EventParam("endpoint", ethereum.Value.fromString("https://provider.example/v1/responses")),
    new ethereum.EventParam("feedbackURI", ethereum.Value.fromString(URI)),
    new ethereum.EventParam("feedbackHash", ethereum.Value.fromFixedBytes(Bytes.fromHexString(OTHER_TX)))
  ]
  return event
}

function expectedFileId(tx: string, logIndex: i32): string {
  return tx + ":" + logIndex.toString() + ":" + CID
}

function registrationLink(agentId: string): string {
  return Agent.load(agentId)!.registrationFile!
}

function feedbackLink(feedbackId: string): string {
  return Feedback.load(feedbackId)!.feedbackFile!
}

function fileContext(fileId: string, tx: string): DataSourceContext {
  let context = new DataSourceContext()
  context.setString("fileId", fileId)
  context.setString("cid", CID)
  context.setString("txHash", tx)
  context.setBigInt("timestamp", BigInt.fromI32(TIMESTAMP))
  return context
}

// Matchstick does not schedule file templates; run each isolated file handler
// with the context contract supplied by the chain handler.
function parseRegistration(fileId: string, agentId: string, tx: string = TX): void {
  let context = fileContext(fileId, tx)
  context.setString("agentId", agentId)
  dataSourceMock.setReturnValues(CID, "file-id-test", context)
  parseRegistrationFile(Bytes.fromUTF8('{"name":"Shared metadata","active":true,"x402Support":true,"services":[{"name":"OASF","endpoint":"https://example.com/oasf","skills":["vision"],"domains":["technology"]}]}'))
}

function parseFeedback(fileId: string, feedbackId: string, tx: string = TX): void {
  let context = fileContext(fileId, tx)
  context.setString("feedbackId", feedbackId)
  context.setString("tag1OnChain", "quality")
  context.setString("tag2OnChain", "")
  dataSourceMock.setReturnValues(CID, "file-id-test", context)
  parseFeedbackFile(Bytes.fromUTF8('{"text":"Useful result","tag1":"ignored-file-tag","tag2":"vision","oasf":{"skills":["vision"],"domains":["technology"]}}'))
}

function assertRegistration(fileId: string, agentId: string): void {
  assert.fieldEquals("AgentRegistrationFile", fileId, "agentId", agentId)
  assert.fieldEquals("AgentRegistrationFile", fileId, "cid", CID)
  assert.fieldEquals("AgentRegistrationFile", fileId, "createdAt", TIMESTAMP.toString())
  assert.fieldEquals("AgentRegistrationFile", fileId, "name", "Shared metadata")
  assert.fieldEquals("AgentRegistrationFile", fileId, "hasOASF", "true")
}

test("same-transaction registrations sharing a CID retain both agents' files", () => {
  handleAgentRegistered(registered(1, 10))
  handleAgentRegistered(registered(2, 11))

  let first = registrationLink("0:1")
  let second = registrationLink("0:2")
  assert.stringEquals(first, expectedFileId(TX, 10))
  assert.stringEquals(second, expectedFileId(TX, 11))
  assert.assertTrue(first != second)
  assert.dataSourceExists("RegistrationFile", CID)

  parseRegistration(first, "0:1")
  parseRegistration(second, "0:2")
  assert.entityCount("AgentRegistrationFile", 2)
  assertRegistration(first, "0:1")
  assertRegistration(second, "0:2")
  assert.fieldEquals("Agent", "0:1", "owner", OWNER)
  assert.fieldEquals("Agent", "0:2", "owner", OWNER)
  assert.notInStore("AgentRegistrationFile", TX + ":" + CID)
})

test("repeated URIUpdated events preserve both versions and link the latest", () => {
  handleAgentRegistered(registered(1, 9, ""))
  handleUriUpdated(uriUpdated(1, 10))
  let first = registrationLink("0:1")
  handleUriUpdated(uriUpdated(1, 11))
  let second = registrationLink("0:1")
  assert.stringEquals(first, expectedFileId(TX, 10))
  assert.stringEquals(second, expectedFileId(TX, 11))

  parseRegistration(first, "0:1")
  parseRegistration(second, "0:1")
  assert.entityCount("AgentRegistrationFile", 2)
  assertRegistration(first, "0:1")
  assertRegistration(second, "0:1")
  assert.fieldEquals("Agent", "0:1", "registrationFile", second)
})

test("Registered and URIUpdated in one transaction do not share a file ID", () => {
  handleAgentRegistered(registered(1, 10))
  let first = registrationLink("0:1")
  handleUriUpdated(uriUpdated(1, 11))
  let second = registrationLink("0:1")
  assert.stringEquals(first, expectedFileId(TX, 10))
  assert.stringEquals(second, expectedFileId(TX, 11))

  parseRegistration(first, "0:1")
  parseRegistration(second, "0:1")
  assert.entityCount("AgentRegistrationFile", 2)
  assertRegistration(first, "0:1")
  assertRegistration(second, "0:1")
  assert.fieldEquals("Agent", "0:1", "registrationFile", second)
})

test("registrations in different transactions with the same log index remain distinct", () => {
  handleAgentRegistered(registered(1, 10))
  handleAgentRegistered(registered(2, 10, URI, OTHER_TX, BLOCK + 1))
  let first = registrationLink("0:1")
  let second = registrationLink("0:2")
  assert.stringEquals(first, expectedFileId(TX, 10))
  assert.stringEquals(second, expectedFileId(OTHER_TX, 10))

  parseRegistration(first, "0:1")
  parseRegistration(second, "0:2", OTHER_TX)
  assert.entityCount("AgentRegistrationFile", 2)
  assertRegistration(first, "0:1")
  assertRegistration(second, "0:2")
})

test("same-transaction feedback sharing a CID retains both files and feedback counters", () => {
  handleAgentRegistered(registered(1, 9, ""))
  handleNewFeedback(newFeedback(1, 1, 10))
  handleNewFeedback(newFeedback(1, 2, 11))
  let firstFeedback = "0:1:" + CLIENT + ":1"
  let secondFeedback = "0:1:" + CLIENT + ":2"
  let first = feedbackLink(firstFeedback)
  let second = feedbackLink(secondFeedback)
  assert.stringEquals(first, expectedFileId(TX, 10))
  assert.stringEquals(second, expectedFileId(TX, 11))
  assert.dataSourceExists("FeedbackFile", CID)

  parseFeedback(first, firstFeedback)
  parseFeedback(second, secondFeedback)
  assert.entityCount("FeedbackFile", 2)
  assert.fieldEquals("FeedbackFile", first, "feedbackId", firstFeedback)
  assert.fieldEquals("FeedbackFile", second, "feedbackId", secondFeedback)
  assert.fieldEquals("FeedbackFile", first, "cid", CID)
  assert.fieldEquals("FeedbackFile", second, "cid", CID)
  assert.fieldEquals("FeedbackFile", first, "text", "Useful result")
  assert.fieldEquals("FeedbackFile", second, "tag2", "vision")
  assert.fieldEquals("Feedback", firstFeedback, "tag1", "quality")
  assert.fieldEquals("Feedback", secondFeedback, "tag1", "quality")
  assert.fieldEquals("Feedback", firstFeedback, "value", "8.75")
  assert.fieldEquals("Feedback", secondFeedback, "value", "8.75")
  assert.fieldEquals("Agent", "0:1", "totalFeedback", "2")
  assert.notInStore("FeedbackFile", TX + ":" + CID)
})

test("feedback in different transactions with the same log index remains distinct", () => {
  handleAgentRegistered(registered(1, 8, ""))
  handleAgentRegistered(registered(2, 9, ""))
  handleNewFeedback(newFeedback(1, 1, 10))
  handleNewFeedback(newFeedback(2, 1, 10, OTHER_TX, BLOCK + 1))
  let firstFeedback = "0:1:" + CLIENT + ":1"
  let secondFeedback = "0:2:" + CLIENT + ":1"
  let first = feedbackLink(firstFeedback)
  let second = feedbackLink(secondFeedback)
  assert.stringEquals(first, expectedFileId(TX, 10))
  assert.stringEquals(second, expectedFileId(OTHER_TX, 10))

  parseFeedback(first, firstFeedback)
  parseFeedback(second, secondFeedback, OTHER_TX)
  assert.entityCount("FeedbackFile", 2)
  assert.fieldEquals("FeedbackFile", first, "feedbackId", firstFeedback)
  assert.fieldEquals("FeedbackFile", second, "feedbackId", secondFeedback)
  assert.fieldEquals("Agent", "0:1", "totalFeedback", "1")
  assert.fieldEquals("Agent", "0:2", "totalFeedback", "1")
})

test("registration parser consumes opaque context file IDs without reconstructing them", () => {
  parseRegistration("registration-context-first", "0:1")
  parseRegistration("registration-context-second", "0:2")

  assert.entityCount("AgentRegistrationFile", 2)
  assertRegistration("registration-context-first", "0:1")
  assertRegistration("registration-context-second", "0:2")
  assert.notInStore("AgentRegistrationFile", TX + ":" + CID)
})

test("feedback parser consumes opaque context file IDs without reconstructing them", () => {
  let firstFeedback = "0:1:" + CLIENT + ":1"
  let secondFeedback = "0:1:" + CLIENT + ":2"
  parseFeedback("feedback-context-first", firstFeedback)
  parseFeedback("feedback-context-second", secondFeedback)

  assert.entityCount("FeedbackFile", 2)
  assert.fieldEquals("FeedbackFile", "feedback-context-first", "feedbackId", firstFeedback)
  assert.fieldEquals("FeedbackFile", "feedback-context-second", "feedbackId", secondFeedback)
  assert.fieldEquals("FeedbackFile", "feedback-context-first", "cid", CID)
  assert.fieldEquals("FeedbackFile", "feedback-context-second", "tag2", "vision")
  assert.notInStore("FeedbackFile", TX + ":" + CID)
})
