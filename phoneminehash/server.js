// server.js
require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const twilio = require("twilio");

const app = express();
app.use(express.json());

/* ------------------------- Blockchain Setup ------------------------- */
class Block {
  constructor(index, timestamp, transactions, previousHash = "") {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash("sha256")
      .update(
        this.index +
          this.timestamp +
          JSON.stringify(this.transactions) +
          this.previousHash +
          this.nonce
      )
      .digest("hex");
  }

  mineBlock(difficulty) {
    while (
      this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")
    ) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log(`✅ Block mined: ${this.hash}`);
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 3;
    this.pendingTransactions = [];
  }

  createGenesisBlock() {
    return new Block(0, Date.now().toString(), "Genesis Block", "0");
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  minePendingTransactions() {
    const block = new Block(
      this.chain.length,
      Date.now().toString(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );
    block.mineBlock(this.difficulty);

    this.chain.push(block);
    this.pendingTransactions = [];
  }

  addTransaction(transaction) {
    this.pendingTransactions.push(transaction);
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      if (current.hash !== current.calculateHash()) return false;
      if (current.previousHash !== previous.hash) return false;
    }
    return true;
  }
}

const phoneChain = new Blockchain();

/* ------------------------- Twilio Setup ------------------------- */
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  console.error("❌ Missing Twilio credentials in .env");
  process.exit(1);
}

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* ------------------------- API Routes ------------------------- */

// Health check
app.get("/", (req, res) => {
  res.send("📱 PhoneChain server running with Twilio + Blockchain!");
});

// Send SMS + log to blockchain
app.post("/send-sms", async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: "Missing 'to' or 'message'" });
    }

    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    // Log SMS as a blockchain transaction
    const tx = {
      to: to,
      message: message,
      sid: sms.sid,
      timestamp: new Date().toISOString()
    };

    phoneChain.addTransaction(tx);
    phoneChain.minePendingTransactions();

    res.json({ success: true, sid: sms.sid, blockchainHeight: phoneChain.chain.length });
  } catch (err) {
    console.error("❌ Twilio error:", err);
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

// View blockchain
app.get("/chain", (req, res) => {
  res.json(phoneChain.chain);
});

// Validate chain
app.get("/validate", (req, res) => {
  res.json({ valid: phoneChain.isChainValid() });
});

/* ------------------------- Start Server ------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
