# Manual Test Cases - Research Assistant

This document provides a comprehensive list of manual test cases to validate the usability and functionality of the Research Assistant system.

## Table of Contents

1. [Basic Query Processing](#1-basic-query-processing)
2. [Clarity Agent & Query Analysis](#2-clarity-agent--query-analysis)
3. [Human-in-the-Loop (Clarification Interrupts)](#3-human-in-the-loop-clarification-interrupts)
4. [Research Agent](#4-research-agent)
5. [Validation Loop](#5-validation-loop)
6. [Synthesis Agent](#6-synthesis-agent)
7. [Multi-Turn Conversations](#7-multi-turn-conversations)
8. [Streaming & Progress Display](#8-streaming--progress-display)
9. [Error Handling & Recovery](#9-error-handling--recovery)
10. [Edge Cases & Input Validation](#10-edge-cases--input-validation)
11. [Special Commands](#11-special-commands)
12. [Configuration & Environment](#12-configuration--environment)
13. [Performance & Reliability](#13-performance--reliability)
14. [Mock Data vs Tavily API](#14-mock-data-vs-tavily-api)

---

## 1. Basic Query Processing

### TC-1.1: Simple Company Query

**Description:** User asks about a well-known company
**Input:** `Tell me about Apple`
**Expected:** System returns a comprehensive summary about Apple Inc. with recent news, stock info, and key developments

### TC-1.2: Company Query with Full Name

**Description:** User uses the full company name
**Input:** `What's happening with Tesla Inc.?`
**Expected:** System normalizes the name and returns Tesla information

### TC-1.3: Company Query with Common Abbreviation

**Description:** User uses common name variant
**Input:** `Give me info on Google`
**Expected:** System normalizes to "Alphabet Inc." and returns relevant information

### TC-1.4: Query with Specific Focus

**Description:** User asks about a specific aspect of a company
**Input:** `What are Microsoft's recent acquisitions?`
**Expected:** System focuses research on acquisition-related news and developments

### TC-1.5: Financial Query

**Description:** User asks about stock/financial info
**Input:** `How is Amazon stock performing?`
**Expected:** System includes stock price and financial information in response

---

## 2. Clarity Agent & Query Analysis

### TC-2.1: Clear Query Recognition

**Description:** System correctly identifies a clear, unambiguous query
**Input:** `Tell me about Netflix`
**Expected:** Query proceeds directly to research without clarification request

### TC-2.2: Ambiguous Company Name

**Description:** Query contains ambiguous company reference
**Input:** `Tell me about the fruit company`
**Expected:** System requests clarification (which company?)

### TC-2.3: Multiple Companies in Query

**Description:** User mentions multiple companies
**Input:** `Compare Apple and Samsung`
**Expected:** System either handles both or asks which to focus on first

### TC-2.4: No Company Mentioned

**Description:** Query doesn't clearly reference a company
**Input:** `What's the latest news?`
**Expected:** System asks for clarification about which company

### TC-2.5: Ambiguous Acronym

**Description:** Query uses an acronym that could mean multiple things
**Input:** `Tell me about AI`
**Expected:** System asks for clarification (company or topic?)

### TC-2.6: Similar Company Names

**Description:** Query mentions a name that matches multiple companies
**Input:** `Tell me about Meta`
**Expected:** System identifies Meta/Facebook or asks for clarification if ambiguous

---

## 3. Human-in-the-Loop (Clarification Interrupts)

### TC-3.1: Respond to Clarification Request

**Description:** User provides clarification when asked
**Precondition:** System has asked for clarification
**Input:** `I meant Apple the tech company`
**Expected:** System resumes research with clarified context

### TC-3.2: Provide Different Answer on Clarification

**Description:** User changes their mind during clarification
**Precondition:** System asked about "Apple"
**Input:** `Actually, tell me about Microsoft instead`
**Expected:** System researches Microsoft instead

### TC-3.3: Clarification Loop Limit

**Description:** System doesn't loop indefinitely on clarification
**Input:** Repeatedly provide vague answers to clarification requests
**Expected:** After 2 clarification attempts, system proceeds with best guess or provides helpful error

### TC-3.4: Empty Clarification Response

**Description:** User provides empty or whitespace response to clarification
**Input:** `   ` (whitespace only)
**Expected:** System handles gracefully, may re-ask or provide guidance

---

## 4. Research Agent

### TC-4.1: Company with Rich Data (Mock Mode)

**Description:** Query a company that has extensive mock data
**Input:** `Tell me about Apple`
**Expected:** High confidence score (≥6), comprehensive findings with multiple sources

### TC-4.2: Company with Limited Data

**Description:** Query a company with minimal available data
**Input:** `Tell me about [obscure startup name]`
**Expected:** Lower confidence score, system still provides available information

### TC-4.3: Unknown Company

**Description:** Query a company not in the system
**Input:** `Tell me about XYZ Nonexistent Corp`
**Expected:** System indicates no data found, provides helpful message

### TC-4.4: High Confidence Research (Skip Validation)

**Description:** Research returns high confidence score
**Input:** Query well-known company
**Expected:** Confidence ≥6 skips validation, proceeds directly to synthesis

### TC-4.5: Low Confidence Research (Triggers Validation)

**Description:** Research returns low confidence score
**Input:** Query less-known company
**Expected:** Confidence <6 triggers validation step

### TC-4.6: Research with Real API (Tavily)

**Description:** Test with real Tavily API enabled
**Precondition:** `TAVILY_API_KEY` environment variable set
**Input:** `Tell me about Apple`
**Expected:** Returns real-time web search results

---

## 5. Validation Loop

### TC-5.1: Sufficient Research on First Try

**Description:** Research passes validation immediately
**Input:** Query well-documented company
**Expected:** Validation returns "sufficient", proceeds to synthesis

### TC-5.2: Insufficient Research - Retry Success

**Description:** Research fails validation but succeeds on retry
**Input:** Query moderately documented company
**Expected:** First attempt insufficient, retry succeeds, proceeds to synthesis

### TC-5.3: Maximum Retry Limit

**Description:** Research fails validation multiple times
**Input:** Query poorly documented company
**Expected:** After 3 attempts, system proceeds to synthesis with best available data

### TC-5.4: Validation Feedback Applied

**Description:** Validator feedback improves retry quality
**Precondition:** First research attempt is insufficient
**Expected:** Retry attempt addresses validator feedback (e.g., find more sources)

### TC-5.5: Validation Criteria Check

**Description:** Verify validation criteria are applied correctly
**Test:** Research with:

- No recent news AND no key developments → Should fail
- Has recent news OR key developments → May pass
- Has ≥2 sources → Higher chance of passing
  **Expected:** Validation aligns with documented criteria

---

## 6. Synthesis Agent

### TC-6.1: Comprehensive Summary Generation

**Description:** System generates well-structured summary
**Input:** Query company with rich data
**Expected:** Summary includes overview, news, financials (if available), and key points

### TC-6.2: High Confidence Prefix

**Description:** High confidence research shows appropriate prefix
**Expected:** Summary may indicate high confidence level in response

### TC-6.3: Low Confidence Prefix

**Description:** Low confidence research shows appropriate prefix
**Expected:** Summary indicates uncertainty or limited data availability

### TC-6.4: No Data Summary

**Description:** Synthesis handles case with no research data
**Input:** Query unknown company
**Expected:** Helpful message guiding user on alternatives

### TC-6.5: Partial Data Summary

**Description:** Synthesis with incomplete research data
**Input:** Query company with only partial information
**Expected:** Summary presents available data, notes gaps

### TC-6.6: Source Attribution

**Description:** Summary includes source references
**Expected:** Sources from research are included/referenced in final output

---

## 7. Multi-Turn Conversations

### TC-7.1: Follow-Up Question

**Description:** User asks follow-up about same company
**Turn 1:** `Tell me about Apple`
**Turn 2:** `What about their latest products?`
**Expected:** System maintains context, researches Apple products

### TC-7.2: Switch Companies

**Description:** User switches to different company
**Turn 1:** `Tell me about Apple`
**Turn 2:** `Now tell me about Google`
**Expected:** System researches Google, may reference comparison if relevant

### TC-7.3: Reference Previous Response

**Description:** User references previous answer
**Turn 1:** `Tell me about Tesla`
**Turn 2:** `Tell me more about that stock price you mentioned`
**Expected:** System understands reference to previous Tesla response

### TC-7.4: Conversation History Preserved

**Description:** System remembers earlier conversation
**Multiple Turns:** Series of queries about various companies
**Expected:** System can reference/recall earlier parts of conversation

### TC-7.5: Long Conversation Session

**Description:** Extended conversation session
**Input:** 10+ turns of queries and follow-ups
**Expected:** System handles context appropriately, may summarize older context

### TC-7.6: Context Reset with "new"

**Description:** Starting fresh conversation
**Input:** `new`
**Expected:** New thread ID generated, previous context cleared

---

## 8. Streaming & Progress Display

### TC-8.1: Progress Indicators Display

**Description:** User sees progress as query processes
**Expected:** See emojis/text indicating:

- 🔍 Analyzing query...
- 📚 Researching...
- ✅ Validating findings...
- 📝 Generating summary...

### TC-8.2: Token Streaming (if enabled)

**Description:** Real-time token output during generation
**Precondition:** Token streaming enabled
**Expected:** See LLM output character-by-character

### TC-8.3: Streaming During Long Research

**Description:** Progress updates during extended research
**Expected:** User doesn't see frozen screen, receives updates

### TC-8.4: Interrupt Display

**Description:** Clarification request shown clearly
**Precondition:** Ambiguous query triggers interrupt
**Expected:** Clear prompt showing question and how to respond

---

## 9. Error Handling & Recovery

### TC-9.1: Network Error During Research

**Description:** Network failure during API call
**Precondition:** Simulate network disconnection
**Expected:** Graceful error message, suggests retry

### TC-9.2: LLM API Error

**Description:** LLM service returns error
**Precondition:** Invalid API key or service outage
**Expected:** Fallback behavior activates, user sees helpful message

### TC-9.3: Timeout During Research

**Description:** Research takes too long
**Precondition:** Slow API response exceeds timeout
**Expected:** Timeout error with helpful message

### TC-9.4: Partial Failure Recovery

**Description:** Some agents succeed, one fails
**Expected:** System provides partial results if available, explains what failed

### TC-9.5: Error Recovery Agent Messages

**Description:** Error messages are context-appropriate
**Test:** Trigger errors in different agents
**Expected:** Each agent failure produces appropriate error message:

- Clarity agent failure → "Unable to understand query"
- Research agent failure → "Unable to gather information"
- Synthesis agent failure → "Unable to generate summary"

### TC-9.6: Resume After Error

**Description:** User can continue after error
**Precondition:** Error occurred in previous query
**Input:** New valid query
**Expected:** System processes new query normally

---

## 10. Edge Cases & Input Validation

### TC-10.1: Empty Query

**Description:** User submits empty input
**Input:** `` (empty) or just hitting Enter
**Expected:** System prompts for valid input

### TC-10.2: Whitespace-Only Query

**Description:** User submits only spaces/tabs
**Input:** `     ` (whitespace)
**Expected:** System handles as empty, prompts for input

### TC-10.3: Very Long Query

**Description:** Query at maximum length
**Input:** 5000 character query
**Expected:** System processes or truncates appropriately

### TC-10.4: Query Exceeding Maximum Length

**Description:** Query over 5000 characters
**Input:** 5001+ character query
**Expected:** System rejects with helpful message about limit

### TC-10.5: Special Characters in Query

**Description:** Query contains special characters
**Input:** `Tell me about Apple 🍎 Inc. (AAPL) $$$`
**Expected:** System handles gracefully, extracts company name

### TC-10.6: SQL Injection Attempt

**Description:** Malicious input attempt
**Input:** `'; DROP TABLE companies; --`
**Expected:** System treats as regular query, no security breach

### TC-10.7: Script Injection Attempt

**Description:** XSS-style input
**Input:** `<script>alert('xss')</script>`
**Expected:** System sanitizes input, no code execution

### TC-10.8: Unicode Characters

**Description:** Query with international characters
**Input:** `Tell me about 阿里巴巴 (Alibaba)`
**Expected:** System handles Unicode correctly

### TC-10.9: Null Bytes

**Description:** Query containing null bytes
**Input:** `Tell me about Apple\x00Inc`
**Expected:** Null bytes rejected or sanitized

### TC-10.10: Query with Only Numbers

**Description:** Numeric-only query
**Input:** `12345`
**Expected:** System asks for clarification

---

## 11. Special Commands

### TC-11.1: Quit Command

**Description:** User exits application
**Input:** `quit`
**Expected:** Application exits gracefully with goodbye message

### TC-11.2: Quit Case Insensitivity

**Description:** Quit command in different cases
**Input:** `QUIT`, `Quit`, `QuIt`
**Expected:** All variations exit the application

### TC-11.3: New Thread Command

**Description:** User starts new conversation
**Input:** `new`
**Expected:**

- New thread ID generated
- Previous context cleared
- Confirmation message shown

### TC-11.4: New Command Case Insensitivity

**Description:** New command in different cases
**Input:** `NEW`, `New`
**Expected:** All variations start new thread

### TC-11.5: Command-Like Query

**Description:** Query that looks like a command
**Input:** `new Apple products` or `quit your job at Google`
**Expected:** Treated as research query, not command

---

## 12. Configuration & Environment

> **Note:** For comprehensive Mock vs Tavily API testing, see [Section 14](#14-mock-data-vs-tavily-api).

### TC-12.1: LangSmith Tracing (if configured)

**Description:** Requests traced in LangSmith
**Precondition:** LangSmith configured
**Expected:** Traces appear in LangSmith dashboard

### TC-12.2: Log Level Configuration

**Description:** Different log levels work correctly
**Test:** Set log level to debug, info, warn, error
**Expected:** Appropriate level of logging output

### TC-12.3: Correlation ID Tracking

**Description:** Requests have unique correlation IDs
**Expected:** Each request logged with unique ID for debugging

### TC-12.4: Missing Required Environment Variable

**Description:** Required env var missing
**Precondition:** Remove required API key (e.g., `OPENAI_API_KEY`)
**Expected:** Clear error message about missing configuration

---

## 13. Performance & Reliability

### TC-13.1: Response Time - Simple Query

**Description:** Simple query returns in reasonable time
**Input:** `Tell me about Apple`
**Expected:** Response within 30 seconds

### TC-13.2: Response Time - Complex Query

**Description:** Complex query with validation retries
**Input:** Query triggering validation loop
**Expected:** Response within 2 minutes

### TC-13.3: Execution Timeout

**Description:** System respects maximum execution timeout
**Precondition:** Configure 5 minute timeout
**Expected:** Long-running queries timeout with message

### TC-13.4: Concurrent Requests (if applicable)

**Description:** Multiple simultaneous requests
**Input:** Submit multiple queries rapidly
**Expected:** All requests handled without interference

### TC-13.5: Memory Usage

**Description:** System doesn't leak memory
**Test:** Long session with many queries
**Expected:** Memory usage remains stable

### TC-13.6: Token Budget Handling

**Description:** Large responses respect token limits
**Input:** Query that would generate very long response
**Expected:** Response truncated/summarized to fit limits

### TC-13.7: Graceful Degradation

**Description:** System works with partial failures
**Test:** Simulate API intermittent failures
**Expected:** System provides best effort response, doesn't crash

---

## 14. Mock Data vs Tavily API

This section covers comprehensive testing of the two data source modes: mock (static) data and real-time Tavily web search API.

### Mode Detection & Switching

### TC-14.1: Automatic Mock Mode Detection

**Description:** System defaults to mock mode when Tavily API key is missing
**Precondition:** Unset or remove `TAVILY_API_KEY` environment variable
**Input:** `Tell me about Apple`
**Expected:**

- System uses mock data without errors
- No API connection attempts to Tavily
- Response contains mock data characteristics (predictable content)

### TC-14.2: Automatic Tavily Mode Detection

**Description:** System uses Tavily when API key is present
**Precondition:** Set valid `TAVILY_API_KEY` environment variable
**Input:** `Tell me about Apple`
**Expected:**

- System makes requests to Tavily API
- Response contains real-time web search results
- Sources reference actual URLs

### TC-14.3: Invalid Tavily API Key

**Description:** System handles invalid API key gracefully
**Precondition:** Set `TAVILY_API_KEY` to an invalid value (e.g., `invalid_key_12345`)
**Input:** `Tell me about Apple`
**Expected:**

- System detects authentication failure
- Falls back to mock data OR provides clear error message
- Does not crash or hang

### TC-14.4: Empty Tavily API Key

**Description:** System handles empty API key
**Precondition:** Set `TAVILY_API_KEY=""` (empty string)
**Input:** `Tell me about Apple`
**Expected:** System treats as no key, uses mock mode

### Comparison Testing (Same Query, Both Modes)

### TC-14.5: Known Company - Mock vs Tavily

**Description:** Compare results for well-known company in both modes
**Test Steps:**

1. Run with mock mode: `Tell me about Apple`
2. Run with Tavily mode: `Tell me about Apple`
   **Expected:**

- Mock: Returns static, predictable data
- Tavily: Returns current, real-time data
- Both provide valid, usable responses
- Tavily results may include more recent news

### TC-14.6: Lesser-Known Company - Mock vs Tavily

**Description:** Compare results for less common company
**Test Steps:**

1. Run with mock mode: `Tell me about Palantir`
2. Run with Tavily mode: `Tell me about Palantir`
   **Expected:**

- Mock: May return limited or no data
- Tavily: Should find real information via web search
- Demonstrates Tavily's advantage for broader coverage

### TC-14.7: Very Recent Event Query

**Description:** Query about breaking news/recent events
**Input:** `What is [Company]'s latest announcement this week?`
**Expected:**

- Mock: Returns static data (may be outdated)
- Tavily: Returns current news (if available)

### TC-14.8: Stock Price Query - Both Modes

**Description:** Financial data accuracy comparison
**Input:** `What is Tesla's current stock price?`
**Expected:**

- Mock: Returns static/sample stock price
- Tavily: May return more current price (if in search results)

### Mock Data Specific Tests

### TC-14.9: Mock Data Completeness - Major Companies

**Description:** Verify mock data exists for major companies
**Test:** Query each of these companies in mock mode:

- Apple
- Google/Alphabet
- Microsoft
- Amazon
- Tesla
- Meta/Facebook
- Netflix
- NVIDIA
  **Expected:** Each returns meaningful mock data

### TC-14.10: Mock Data Structure

**Description:** Mock data contains expected fields
**Input:** Query any supported company in mock mode
**Expected:** Response includes:

- Recent news items
- Stock/financial information (if applicable)
- Key developments
- Source references

### TC-14.11: Unknown Company in Mock Mode

**Description:** Query company not in mock dataset
**Input:** `Tell me about RandomStartup123 Inc`
**Expected:**

- System handles gracefully
- Returns "no data found" message
- Does not crash or return malformed response

### TC-14.12: Mock Data Consistency

**Description:** Same query returns consistent mock results
**Input:** Run `Tell me about Apple` multiple times
**Expected:** Identical or very similar results each time (deterministic)

### Tavily API Specific Tests

### TC-14.13: Tavily Rate Limiting

**Description:** System handles Tavily rate limits
**Precondition:** Valid Tavily API key
**Test:** Send many rapid queries (10+ in quick succession)
**Expected:**

- System handles rate limit responses gracefully
- May queue requests, slow down, or provide informative error
- Does not crash

### TC-14.14: Tavily Timeout

**Description:** System handles slow Tavily responses
**Precondition:** Simulate slow network or Tavily delay
**Expected:**

- Request times out after configured period
- User sees timeout message
- System remains responsive

### TC-14.15: Tavily Empty Results

**Description:** Tavily returns no results for query
**Input:** Query very obscure or nonsensical company name
**Expected:**

- System handles empty result set
- Provides helpful "no results found" message
- May suggest alternative queries

### TC-14.16: Tavily Partial Results

**Description:** Tavily returns fewer results than expected
**Input:** Query niche company with limited web presence
**Expected:**

- System works with available data
- Lower confidence score reflects limited data
- Validation may request retry

### TC-14.17: Tavily Response Format Changes

**Description:** System handles unexpected Tavily response format
**Precondition:** This tests error handling robustness
**Expected:**

- Invalid response format logged
- Graceful degradation to error message
- No unhandled exceptions

### TC-14.18: Tavily Network Error

**Description:** Network failure during Tavily request
**Precondition:** Disconnect network after query starts
**Expected:**

- Network error detected
- Helpful error message to user
- Option to retry or fall back

### Validation Behavior Across Modes

### TC-14.19: Validation Loop - Mock Mode

**Description:** Validation retry behavior with mock data
**Input:** Query company with limited mock data
**Expected:**

- Validation may mark as insufficient
- Retry uses same mock data (limited improvement possible)
- Max retries reached, proceeds to synthesis

### TC-14.20: Validation Loop - Tavily Mode

**Description:** Validation retry behavior with Tavily
**Input:** Query company with moderate web presence
**Expected:**

- Validation may request more sources
- Retry can fetch additional/different results
- Potential for improvement across retries

### TC-14.21: Confidence Scores - Mock vs Tavily

**Description:** Compare confidence scores between modes
**Test:** Same query in both modes
**Expected:**

- Mock: Consistent, predictable confidence scores
- Tavily: Variable based on search results quality
- Both influence validation routing correctly

### Fallback & Resilience

### TC-14.22: Tavily to Mock Fallback

**Description:** System falls back from Tavily to mock on failure
**Precondition:** Tavily API key set but service unavailable
**Expected:**

- System detects Tavily failure
- Falls back to mock data (if implemented)
- OR provides clear error with guidance

### TC-14.23: Intermittent Tavily Failures

**Description:** Tavily works inconsistently
**Test:** Simulate intermittent network issues
**Expected:**

- Some requests succeed, some fail
- Failed requests handled gracefully
- Successful requests return valid data

### TC-14.24: Mode Switching Mid-Session

**Description:** Change API key during running session
**Test:**

1. Start in mock mode
2. Set TAVILY_API_KEY
3. Continue querying
   **Expected:**

- Behavior depends on implementation
- Document observed behavior
- No crashes or data corruption

### Performance Comparison

### TC-14.25: Response Time - Mock Mode

**Description:** Measure mock mode response time
**Input:** `Tell me about Apple`
**Expected:** Fast response (no network calls), typically <5 seconds

### TC-14.26: Response Time - Tavily Mode

**Description:** Measure Tavily mode response time
**Input:** `Tell me about Apple`
**Expected:** Slower than mock (includes API call), typically 5-30 seconds

### TC-14.27: Concurrent Queries - Mock Mode

**Description:** Multiple simultaneous queries in mock mode
**Test:** Submit 5 queries rapidly
**Expected:** All complete quickly, no interference

### TC-14.28: Concurrent Queries - Tavily Mode

**Description:** Multiple simultaneous queries with Tavily
**Test:** Submit 5 queries rapidly
**Expected:**

- Queries may be serialized or rate-limited
- All eventually complete
- No lost requests

---

## Appendix: Test Environment Setup

### Prerequisites

1. Node.js installed (check version requirements in package.json)
2. Dependencies installed (`npm install`)
3. Environment variables configured (see `.env.example`)

### Running the Application

```bash
npm start
# or
npm run dev
```

### Graph Visualization

```bash
npm run graph
```

Generates Mermaid diagram of workflow structure.

### Log Levels

Set `LOG_LEVEL` environment variable:

- `debug` - All messages
- `info` - Informational and above
- `warn` - Warnings and errors
- `error` - Errors only

### Testing Mock vs Tavily Modes

**To test Mock Mode:**

```bash
# Ensure no Tavily key is set
unset TAVILY_API_KEY
npm start
```

**To test Tavily Mode:**

```bash
# Set valid Tavily API key
export TAVILY_API_KEY="your-valid-api-key"
npm start
```

**To test invalid key handling:**

```bash
export TAVILY_API_KEY="invalid_key_12345"
npm start
```

**Quick mode verification:**

- Mock mode: Responses are instant, content is predictable
- Tavily mode: Responses take longer, content reflects current web data

---

## Test Tracking Template

| Test ID | Description                  | Status     | Notes |
| ------- | ---------------------------- | ---------- | ----- |
| TC-1.1  | Simple Company Query         | ⬜ Pending |       |
| TC-1.2  | Company Query with Full Name | ⬜ Pending |       |
| ...     | ...                          | ...        | ...   |

**Status Legend:**

- ⬜ Pending
- ✅ Passed
- ❌ Failed
- ⚠️ Blocked
- 🔄 In Progress
