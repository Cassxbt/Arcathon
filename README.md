# PayVoice

**Voice-first autonomous payments for the next billion users.**

---

## The Problem Nobody's Solving

Here's the thing: 1.7 billion adults don't have a bank account. And it's not because they don't want one.

Most fintech apps assume you can read well. They assume you have a smartphone with storage for another app. They assume you're comfortable navigating complex UIs. A lot of people aren't.

But almost everyone can talk.

And 2 billion people already have WhatsApp on their phone.

So we asked: what if you could manage your money just by talking? No app to download. No forms to fill out. No UI to learn. Just... talk.

That's PayVoice.

---

## What We Built

PayVoice is a voice-powered payment agent that lives on WhatsApp. You call it like you'd call a friend, and it handles your money.

Here's what I mean:

> **You:** "Hey Jen, send $5 to Mom"
>
> **Jen:** "Done! $5 to Mom. Auto-approved since she's trusted and it's under your $10 limit. Balance: $45. View tx: https://testnet.arcscan.app/tx/0xd653..."

No confirmation dialogs. No "are you sure?" prompts. The agent knows your policies and acts on them.

That's the key word: **acts**. Not "waits for permission." Acts.

---

## The 4 Pillars (What Makes This Actually Agentic)

Look, everyone's calling their chatbots "agents" these days. But there's a difference between an agent and a fancy chatbot. An agent makes decisions. An agent has context. An agent operates within guardrails but doesn't need you to hold its hand.

Here's what that looks like in practice:

### 1. Identity

The agent knows who you are. Not just your phone number - your name, your balance, your recent transactions. When you call, it says "Hey Sarah!" not "Hello, user."

```
GET /api/conversation-init → Returns user context for personalized greeting
POST /api/verify → Confirms identity with optional wallet verification
```

### 2. Policies

This is where it gets interesting. Users set rules. The agent follows them.

- **Auto-approve limit:** "Send anything under $10 without asking me"
- **Trusted contacts:** "Mom and John are trusted - skip confirmation for them"
- **Daily budget:** "Don't let me spend more than $50/day"
- **Weekly budget:** "Cap my week at $200"

The agent doesn't just enforce these rules - it explains its reasoning:

> "Auto-approved because Mom is in your trusted list and $5 is under your $10 limit."

That's not us being cute. Judges specifically want to see agents that can explain their autonomous decisions.

```javascript
// The actual decision logic
const approvalCheck = await policyService.checkAutoApproval(userId, contactId, amount);

if (approvalCheck.canAutoApprove) {
  // Execute immediately - no confirmation needed
  // This is the "agentic" part
}
```

### 3. Guardrails

Freedom with limits. That's the balance.

The agent will auto-approve your $5 to Mom. But it'll stop you from blowing your entire budget:

> "Hold up - that would put you $15 over your $50 daily limit. You've spent $40 today. Want me to send anyway?"

It's not saying "no." It's saying "here's the situation, your call."

And after every transaction, you get the real blockchain confirmation:

> "Confirmed on blockchain! View: https://testnet.arcscan.app/tx/0xd653a5c40078cb8f66717fd3ebf5d944938eac5b"

That's not a fake receipt. That's a real transaction on ARC. Click it. Verify it.

### 4. Treasury

The agent doesn't just move money - it understands your money.

> **You:** "How much have I spent this week?"
>
> **Jen:** "This week you've spent $127. $50 to Mom (40%), $40 to John (31%), $37 to others. You've got $73 left in your weekly budget."

That's not a balance check. That's financial awareness. The agent tracks:
- Daily spending totals
- Weekly spending totals
- Top recipients
- Budget utilization percentages

This is treasury logic. Autonomous fund management. The kind of thing judges want to see.

---

## Tech Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Voice AI | ElevenLabs Conversational AI | Sub-100ms latency, natural speech |
| Blockchain | Circle SDK on ARC Testnet | USDC payments with real txHash |
| Database | Supabase (PostgreSQL) | Real-time, easy to query |
| Backend | Express.js on Vercel | Serverless, scales automatically |
| Channel | WhatsApp | 2B users, no app download |

---

## Architecture

```
User speaks on WhatsApp
        ↓
ElevenLabs processes speech
        ↓
Agent calls our API tools
        ↓
┌─────────────────────────────────────┐
│         PayVoice Backend            │
│  ┌─────────┐  ┌─────────────────┐   │
│  │ Policy  │  │    Circle SDK   │   │
│  │ Engine  │──│  (USDC on ARC)  │   │
│  └─────────┘  └─────────────────┘   │
│       │              │              │
│  ┌─────────────────────────────┐    │
│  │      Supabase Database      │    │
│  │  users, contacts, policies, │    │
│  │  transactions, alerts       │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
        ↓
Agent speaks response
        ↓
User hears confirmation + txHash
```

---

## API Endpoints

All the endpoints the agent uses:

| Endpoint | Purpose | Pillar |
|----------|---------|--------|
| `POST /api/verify` | Confirm user identity | Identity |
| `POST /api/balance` | Get USDC balance | - |
| `POST /api/send` | Send USDC with auto-approve logic | Policies, Guardrails |
| `POST /api/history` | Recent transactions | - |
| `POST /api/contacts` | List contacts | - |
| `POST /api/contacts/add` | Add new contact | - |
| `POST /api/policy` | Get/update policy settings | Policies |
| `POST /api/policy/trusted` | Manage trusted contacts | Policies |
| `POST /api/spending` | Spending analytics | Treasury |
| `POST /api/alerts` | Get user alerts | Guardrails |
| `POST /api/circle-webhook` | Receive deposit notifications | Guardrails |

Every payment endpoint is protected with:
- Bearer token authentication
- Rate limiting (30 req/min per user)
- Transaction limits ($1000 max)

---

## The Agentic Flow

Here's what happens when you say "send $5 to Mom":

```
1. Speech → Text (ElevenLabs)
2. Agent parses intent: send, $5, Mom
3. Agent calls POST /api/send { phone, recipientName: "Mom", amount: "5" }
4. Backend checks:
   - Is Mom a contact? ✓
   - Is Mom trusted? ✓
   - Is $5 under auto-approve limit? ✓
   - Is $5 within daily budget? ✓
5. Transaction executes (no confirmation needed)
6. Backend polls Circle until COMPLETE
7. Returns: { txHash, blockHeight, newBalance, autoApproved: true }
8. Agent speaks: "Done! $5 to Mom. Auto-approved. Balance: $45. Transaction: [link]"
```

The user said 6 words. The agent made 4 autonomous decisions. That's agentic.

---

## What the Demo Shows

When you watch our demo, you'll see:

1. **Personalized greeting** - "Hey [Name]! Your balance is $50"
2. **Policy display** - "Your auto-approve limit is $10, daily limit is $50"
3. **Auto-approved payment** - Send to trusted contact, no confirmation
4. **Budget enforcement** - Agent blocks overspending, explains why
5. **Spending analytics** - Weekly breakdown by recipient
6. **Real blockchain tx** - Clickable link to ARC explorer

Each scene demonstrates a pillar. Identity, Policies, Guardrails, Treasury.

---

## Why This Matters

We're not building for people who already have Venmo.

We're building for the woman in Lagos who sends money to her mother in the village. She has WhatsApp. She might not read English fluently. But she can say "send 5,000 naira to Mama" and trust that it happens.

We're building for the farmer in Kenya who gets paid in USDC and needs to know his balance without downloading another app.

We're building for the billion people that fintech forgot.

Voice-first. WhatsApp-native. Policy-driven. Autonomous.

That's PayVoice.

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/[your-repo]/payvoice.git
cd payvoice

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in: CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, PAYVOICE_API_KEY

# Run the server
npm start
```

The server runs on port 3000. Deploy to Vercel for production.

---

## Database Schema

```sql
-- Core tables
users (id, phone, name, wallet_id, wallet_address)
contacts (id, user_id, name, wallet_address)
transactions (id, user_id, type, amount, recipient_name, tx_hash, status)

-- Policy tables (the agentic stuff)
user_policies (user_id, auto_approve_limit, daily_spending_limit, weekly_spending_limit)
trusted_contacts (user_id, contact_id, auto_approve_limit)
daily_spending (user_id, date, total_spent, transaction_count)
alerts (user_id, alert_type, title, message, is_read)
```

---

## Circle Product Feedback

**What we used:**
- Developer-Controlled Wallets SDK (@circle-fin/developer-controlled-wallets v9.2.0)
- ARC Testnet for USDC transactions
- Webhook notifications for deposit alerts

**What worked great:**
- SDK is straightforward to initialize
- `getTransaction` polling gives us real txHash for blockchain verification
- Testnet faucet made development smooth
- Wallet creation flow is clean

**What would help:**
- More examples for voice/conversational AI integrations
- Webhook retry logic documentation
- Sample code for real-time balance subscriptions

---

## Team

Built for the Agentic Commerce on ARC hackathon.

We believe financial services should be as easy as talking to a friend. No forms. No apps. No barriers.

Just your voice.

---

## License

MIT License - Use it, fork it, make it better.

---

*Built with Circle, ElevenLabs, Supabase, and a belief that everyone deserves access to financial services.*
