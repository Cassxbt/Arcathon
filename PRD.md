# PayVoice - Product Requirements Document (PRD)

## Executive Summary

**PayVoice** is a WhatsApp-based voice assistant that enables users to send and receive USDC payments through natural conversation. Built on Circle's Arc blockchain and powered by ElevenLabs conversational AI, PayVoice brings accessible financial services to the 3 billion WhatsApp users worldwide.

**Hackathon:** Agentic Commerce on Arc (lablab.ai)
**Timeline:** January 9-24, 2026
**Target Tracks:** Best Autonomous Commerce + Best Product Design

---

## 1. Product Vision

### Problem Statement
- 1.4 billion adults globally are unbanked
- Many people struggle with traditional banking apps (elderly, visually impaired, low literacy)
- Cross-border payments are expensive and slow
- Existing payment apps require complex UI navigation

### Solution
A voice-first payment assistant on WhatsApp that lets anyone:
- Send money by simply saying "Send $50 to Mom"
- Check balances through natural conversation
- Manage finances without needing to read, type, or navigate apps

### Value Proposition
> "Banking as simple as talking to a friend"

---

## 2. Target Users

### Primary Persona: Maria (Accessibility)
- 65-year-old grandmother
- Sends money to family abroad monthly
- Struggles with smartphone apps
- Comfortable making phone calls

### Secondary Persona: Ahmed (Unbanked)
- 28-year-old gig worker in emerging market
- No traditional bank account
- Uses WhatsApp daily
- Receives payments from international clients

### Tertiary Persona: Sam (Convenience)
- 35-year-old busy professional
- Wants hands-free payments while driving/cooking
- Already uses voice assistants

---

## 3. Feature Specification

### 3.1 MVP Features (Must Ship)

#### F1: Balance Inquiry
- **Trigger:** "What's my balance?" / "How much money do I have?"
- **Response:** Voice readout of current USDC balance
- **Technical:** Call Circle Wallet API, return balance

#### F2: Send Payment
- **Trigger:** "Send $50 to [contact name]"
- **Flow:**
  1. Agent confirms: "You want to send $50 to Mom. Is that correct?"
  2. User confirms: "Yes"
  3. Agent processes: Calls Circle API
  4. Agent confirms: "Done! Sent $50 to Mom. Your new balance is $200."
- **Technical:** Circle Wallet transfer on Arc

#### F3: Voice Confirmation (Security)
- All transactions require verbal confirmation
- Supported phrases: "Yes", "Confirm", "Send it", "Do it"
- Cancel phrases: "No", "Cancel", "Stop", "Wait"

#### F4: Transaction History
- **Trigger:** "What were my recent payments?"
- **Response:** Last 5 transactions read aloud
- **Technical:** Query Circle transaction history

#### F5: Contact Management
- **Trigger:** "Add Mom as a contact with wallet [address]"
- **Response:** "Added Mom to your contacts."
- Store name → wallet address mapping in database

### 3.2 Nice-to-Have Features (If Time Permits)

#### F6: Spending Limits
- "Set my daily limit to $100"
- Agent refuses transactions exceeding limit

#### F7: Multi-Language Support
- Switch language: "Speak to me in Spanish"
- ElevenLabs supports 29 languages

#### F8: Recurring Payments
- "Send $100 to Mom every Friday"
- Scheduled via backend cron job

#### F9: Low Balance Alerts
- Agent proactively calls when balance drops below threshold

#### F10: Request Money
- "Request $50 from John for dinner"
- Sends WhatsApp message to John with payment link

---

## 4. Agent Behavior Rules (CRITICAL)

### 4.1 Core Principles
The agent MUST:
1. **Never hallucinate transaction data** - Only report what API returns
2. **Always confirm before sending** - No silent transactions
3. **Stay focused on payments** - Redirect off-topic conversations
4. **Be honest about limitations** - "I can't do that yet"
5. **Prioritize security** - When in doubt, ask for confirmation

### 4.2 Conversation Guardrails

#### DO:
- Confirm amounts and recipients before processing
- Round numbers for voice (say "fifty dollars" not "fifty point zero zero")
- Offer help when user seems confused
- Keep responses under 15 seconds of speech
- Use natural, warm language

#### DON'T:
- Execute payments without explicit confirmation
- Discuss topics outside of payments/finance
- Make up transaction IDs or reference numbers
- Promise features that don't exist
- Share security-sensitive data (full wallet addresses)

### 4.3 Error Handling

| Scenario | Agent Response |
|----------|----------------|
| Insufficient balance | "You don't have enough funds. Your balance is $30 but you tried to send $50." |
| Unknown recipient | "I don't have a contact named [X]. Would you like to add them?" |
| Network error | "I'm having trouble connecting. Please try again in a moment." |
| Invalid command | "I didn't understand that. You can say things like 'check my balance' or 'send money to Mom'." |

### 4.4 Sample Agent System Prompt

```
You are PayVoice, a friendly and professional voice payment assistant on WhatsApp.

## Your Capabilities:
- Check wallet balance
- Send USDC payments
- View transaction history
- Manage contacts

## Rules You MUST Follow:
1. NEVER execute a payment without the user explicitly confirming with "yes", "confirm", or similar
2. ALWAYS repeat the amount and recipient before asking for confirmation
3. NEVER make up data - only report what you receive from the payment system
4. Keep all responses concise (under 15 seconds when spoken)
5. If asked about anything unrelated to payments, politely redirect: "I'm specialized in payments. Would you like to check your balance or send money?"
6. NEVER reveal full wallet addresses - use contact names only
7. If an error occurs, explain it simply and offer to try again

## Tone:
- Warm and helpful, like a trusted friend
- Professional but not robotic
- Patient with confused users
- Encouraging when users succeed

## Response Format:
- Start with acknowledgment of what user asked
- Provide the information or action
- End with a natural follow-up or closure

## Example Interactions:

User: "How much do I have?"
You: "Your balance is fifty dollars. Would you like to send money or do anything else?"

User: "Send twenty bucks to John"
You: "Got it - sending twenty dollars to John. Just say 'confirm' when you're ready."
User: "Confirm"
You: "Done! Twenty dollars sent to John. Your new balance is thirty dollars."

User: "What's the weather like?"
You: "I'm your payment assistant, so I can't help with weather. But I can check your balance or help you send money if you'd like!"
```

---

## 5. Technical Architecture

### 5.1 System Components

```
┌─────────────────────────────────────────────────────────┐
│                  WHATSAPP USER                          │
└─────────────────────┬───────────────────────────────────┘
                      │ Voice/Text
                      ▼
┌─────────────────────────────────────────────────────────┐
│              WHATSAPP BUSINESS API                      │
│         (via ElevenLabs Integration)                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              ELEVENLABS AGENT                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Speech-to-Text (Whisper)                        │   │
│  │ LLM Brain (Gemini 2.0 Flash)                    │   │
│  │ Text-to-Speech (ElevenLabs Voices)              │   │
│  │ Tool Calling (webhooks to our backend)          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │ Webhook calls
                      ▼
┌─────────────────────────────────────────────────────────┐
│              PAYVOICE BACKEND                           │
│              (Node.js + Express)                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ /api/balance - Get wallet balance               │   │
│  │ /api/send - Execute transfer                    │   │
│  │ /api/history - Get transactions                 │   │
│  │ /api/contacts - Manage contacts                 │   │
│  └─────────────────────────────────────────────────┘   │
│                        │                                │
│              ┌─────────┴─────────┐                     │
│              ▼                   ▼                     │
│  ┌─────────────────┐  ┌─────────────────┐             │
│  │    SUPABASE     │  │  CIRCLE SDK     │             │
│  │   (Database)    │  │   (Payments)    │             │
│  │  - Users        │  │  - Wallets      │             │
│  │  - Contacts     │  │  - Transfers    │             │
│  │  - Sessions     │  │  - History      │             │
│  └─────────────────┘  └─────────────────┘             │
│                                │                       │
└────────────────────────────────┼───────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────┐
│              ARC BLOCKCHAIN                             │
│         (Circle's L1 - USDC Native)                     │
│  - Sub-second finality                                  │
│  - USDC as gas token                                    │
│  - Low, predictable fees                                │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Data Models

#### User
```json
{
  "id": "string",
  "phone": "string",           // WhatsApp phone number
  "wallet_id": "string",       // Circle wallet ID
  "wallet_address": "string",  // Arc blockchain address
  "daily_limit": "number",     // Spending limit (default: 500)
  "language": "string",        // Preferred language
  "created_at": "timestamp"
}
```

#### Contact
```json
{
  "id": "string",
  "user_id": "string",         // Owner of this contact
  "name": "string",            // "Mom", "John", etc.
  "wallet_address": "string",  // Recipient's Arc address
  "created_at": "timestamp"
}
```

#### Transaction (cached from Circle)
```json
{
  "id": "string",
  "user_id": "string",
  "type": "send | receive",
  "amount": "number",
  "recipient_name": "string",
  "circle_tx_id": "string",
  "status": "pending | completed | failed",
  "created_at": "timestamp"
}
```

### 5.3 API Endpoints

| Endpoint | Method | Purpose | ElevenLabs Tool |
|----------|--------|---------|-----------------|
| `/api/balance` | GET | Get user's USDC balance | `check_balance` |
| `/api/send` | POST | Send USDC to contact | `send_payment` |
| `/api/history` | GET | Get recent transactions | `get_history` |
| `/api/contacts` | GET | List user's contacts | `list_contacts` |
| `/api/contacts` | POST | Add new contact | `add_contact` |

### 5.4 Security Measures

1. **Phone Verification** - User's WhatsApp number is their identity
2. **Voice Confirmation** - Required for all transactions
3. **Daily Limits** - Prevent large unauthorized transfers
4. **Rate Limiting** - Max 10 transactions per hour
5. **Session Timeout** - Re-verify after 30 minutes of inactivity

---

## 6. Judging Criteria Alignment

### What Judges Want → How We Deliver

| Criteria | Weight | Our Approach |
|----------|--------|--------------|
| **Technical Integration** | 30% | Full Circle SDK integration on Arc testnet, USDC transfers working end-to-end |
| **Practical Value** | 25% | Solves real problem for billions (accessibility, unbanked), clear use cases |
| **Creativity/Uniqueness** | 20% | Voice-first approach is rare; WhatsApp reach is unique; accessibility angle |
| **Presentation Quality** | 15% | Live demo calling the WhatsApp number; clear video; strong slides |
| **UX/UI Design** | 10% | Voice IS the UI - most natural interface possible |

### Track-Specific Wins

#### Best Autonomous Commerce Application
- Demonstrates buyer-side commerce (user paying)
- Could expand to seller-side (merchant receiving)
- Onchain payments on Arc

#### Best Product Design
- Voice-first = most accessible UX possible
- Serves users who can't use traditional apps
- Natural language = zero learning curve

#### Google Challenge (Bonus)
- Use Gemini 2.0 Flash as the LLM brain
- Mention Google AI Studio in submission
- Eligible for $10K GCP credits

---

## 7. Demo Script (For Judges)

### Live Demo Flow (2 minutes)

**[SCREEN: Show WhatsApp on phone]**

PRESENTER: "Meet PayVoice - banking as simple as talking to a friend."

**[CALL WhatsApp number]**

AI: "Hi! This is PayVoice, your voice payment assistant. How can I help?"

PRESENTER: "What's my balance?"

AI: "You have 150 dollars in your account. Would you like to send money?"

PRESENTER: "Send 25 dollars to Mom"

AI: "Sending 25 dollars to Mom. Just say 'confirm' when ready."

PRESENTER: "Confirm"

AI: "Done! 25 dollars sent to Mom. Your new balance is 125 dollars."

**[SCREEN: Show Arc blockchain explorer with transaction]**

PRESENTER: "That transaction just settled on Arc in under one second, using USDC. No credit cards, no banks, no apps to learn - just your voice."

**[END]**

---

## 8. Development Milestones

### Milestone 1: Foundation (Day 1-3)
- [ ] Circle developer account setup
- [ ] Arc testnet wallet created
- [ ] Test USDC obtained from faucet
- [ ] Basic transfer working via API

### Milestone 2: Voice Agent (Day 4-6)
- [ ] ElevenLabs agent created
- [ ] System prompt configured
- [ ] WhatsApp Business connected
- [ ] Basic conversation working

### Milestone 3: Integration (Day 7-10)
- [ ] Backend deployed (Vercel/Railway)
- [ ] Database setup (Supabase)
- [ ] Webhooks connected to ElevenLabs
- [ ] Balance check working via voice

### Milestone 4: Payments (Day 11-13)
- [ ] Send payment flow complete
- [ ] Voice confirmation working
- [ ] Transaction history working
- [ ] Contact management working

### Milestone 5: Polish (Day 14-15)
- [ ] Error handling complete
- [ ] Edge cases covered
- [ ] Demo recording done
- [ ] Slides created
- [ ] Submission materials ready

---

## 9. Submission Checklist

### Required Materials
- [ ] Project Title: "PayVoice - Voice-First Payments on WhatsApp"
- [ ] Short Description (150 chars): "Send money by voice on WhatsApp. Built on Circle's Arc with USDC. Banking as simple as talking."
- [ ] Long Description (detailed writeup)
- [ ] Cover Image (16:9, PNG/JPG)
- [ ] Demo Video (MP4, 2-3 minutes)
- [ ] Slide Deck (PDF)
- [ ] GitHub Repository (public)
- [ ] Live Demo URL (the WhatsApp number)

### Technical Tags
- Circle Wallets
- Arc Blockchain
- USDC
- ElevenLabs
- Gemini (for Google prize)
- WhatsApp
- Voice AI

---

## 10. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Circle API issues | Medium | High | Test early; have fallback responses |
| ElevenLabs rate limits | Low | Medium | Cache responses; optimize calls |
| Voice recognition errors | Medium | Medium | Add "I didn't catch that" handling |
| WhatsApp approval delays | Medium | High | Apply for WhatsApp Business immediately |
| Network latency | Low | Low | Show "processing" state |

---

## 11. Success Metrics

### For Hackathon
- Working end-to-end demo
- < 3 second response time for balance check
- < 5 second response time for transfers
- 95%+ voice recognition accuracy in demo

### Post-Hackathon (If We Win)
- User registrations
- Transaction volume
- Geographic reach
- Accessibility impact stories

---

## 12. Next Steps (Immediate Actions)

1. **Today:** Create Circle developer account at developers.circle.com
2. **Today:** Set up WhatsApp Business account (may take time for approval)
3. **Tomorrow:** Configure ElevenLabs agent with system prompt above
4. **Tomorrow:** Create basic Node.js backend with one endpoint
5. **Day 3:** First integration test - voice to balance check

---

*This PRD is a living document. Update as we learn and iterate.*

*Last Updated: January 2026*
