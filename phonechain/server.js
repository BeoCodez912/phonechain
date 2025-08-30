const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const twilio = require("twilio");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

// Blockchain in-memory
let blockchain = [];

// Genesis block
function createGenesisBlock() {
  return {
    index: 0,
    timestamp: Date.now(),
    transactions: [],
    previousHash: "0",
    nonce: 0,
    hash: "GENESIS_HASH"
  };
}
if (blockchain.length === 0) blockchain.push(createGenesisBlock());

// Hash & PoW
function calculateHash(block) {
  return crypto
    .createHash("sha256")
    .update(
      block.index +
      block.timestamp +
      JSON.stringify(block.transactions) +
      block.previousHash +
      block.nonce
    )
    .digest("hex");
}

function mineBlock(block, difficulty = 4) {
  while (block.hash.substring(0, difficulty) !== "0".repeat(difficulty)) {
    block.nonce++;
    block.hash = calculateHash(block);
  }
  return block;
}

// Twilio client
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH;
const client = twilio(TWILIO_SID, TWILIO_AUTH);

// API: add transaction & mine block
app.post("/api/charge-and-notify", async (req, res) => {
  const { fromNumber, toNumber, amountUSD, bytes } = req.body;
  if (!fromNumber || !toNumber || !amountUSD) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const transaction = {
    fromNumber,
    toNumber,
    amountUSD,
    bytes,
    timestamp: Date.now()
  };

  const prevBlock = blockchain[blockchain.length - 1];
  let newBlock = {
    index: blockchain.length,
    timestamp: Date.now(),
    transactions: [transaction],
    previousHash: prevBlock.hash,
    nonce: 0,
    hash: ""
  };
  newBlock.hash = calculateHash(newBlock);
  newBlock = mineBlock(newBlock);

  blockchain.push(newBlock);

  // Send SMS via Twilio
  try {
    await client.messages.create({
      body: `Blockchain charge: $${amountUSD.toFixed(2)} from ${fromNumber} to ${toNumber}`,
      from: fromNumber,
      to: toNumber
    });
  } catch (err) {
    console.error("Twilio error:", err.message);
  }

  res.json({ message: "Block mined and SMS sent", block: newBlock });
});

// API: fetch blockchain
app.get("/api/chain", (req, res) => {
  res.json(blockchain);
});

// Railway dynamic port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
