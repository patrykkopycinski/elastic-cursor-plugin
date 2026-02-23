# Security (SIEM) Demo Script

Simulated auth log analysis with detection rules, alerts, and exceptions.

**Prerequisites:** Elastic deployment with KIBANA_URL configured. Environment variables ES_URL and ES_API_KEY (or ES_USERNAME/ES_PASSWORD) set.

---

## Step 1: SIEM Quickstart

**What to say:** "First, let's set up the SIEM foundations on our deployment."

**Prompt to type:**

> Run the SIEM quickstart for my deployment

**MCP tool invoked:** `siem_quickstart`

**What the audience sees:** The AI walks through enabling default detection rules, verifying Elastic Agent data shipper configuration, and confirming the security app is ready.

---

## Step 2: Populate auth log data

**What to say:** "Now we need some data. This script generates 200 simulated auth events -- normal logins, brute-force attempts, privilege escalations, and account lockouts."

**Run in terminal:**

```bash
cd examples/security
npm install
node generate-auth-logs.js
```

**What the audience sees:** Console output confirming ~200 events indexed into `auth-logs`.

---

## Step 3: Create a detection rule

**What to say:** "Let's ask the AI to create a rule that catches brute-force login attempts."

**Prompt to type:**

> Create a detection rule that fires when there are more than 5 failed logins from the same IP within 5 minutes

**MCP tool invoked:** `create_detection_rule`

**What the audience sees:** The AI creates a threshold-based detection rule on `auth-logs` filtering by `action: login_failure`, grouped by `source_ip`, with a threshold of 5 in a 5-minute window.

---

## Step 4: List detection rules

**What to say:** "Let's verify the rule was created."

**Prompt to type:**

> List my detection rules

**MCP tool invoked:** `list_detection_rules`

**What the audience sees:** A table or list of detection rules including the one just created.

---

## Step 5: Check security alerts

**What to say:** "The brute-force pattern in our data should have triggered alerts. Let's look at the high-severity ones."

**Prompt to type:**

> Show me security alerts with severity high or critical

**MCP tool invoked:** `get_security_alerts`

**What the audience sees:** Alert results showing the brute-force IPs and affected users.

---

## Step 6: Add a rule exception

**What to say:** "Our CI bot triggers some false positives. Let's add an exception to suppress those."

**Prompt to type:**

> Add an exception for the CI bot user to reduce false positives

**MCP tool invoked:** `add_rule_exception`

**What the audience sees:** The AI adds an exception entry for `user: ci-bot` on the brute-force detection rule, reducing noise in future alert runs.

---

## Wrap-up

**Key points to highlight:**

- Six natural-language prompts, zero YAML or JSON written by hand.
- SIEM quickstart gets the security app production-ready in one step.
- Detection rules, alerts, and exceptions managed entirely through conversation.
- The data script is reusable for any demo environment.
