# Portal entry

The fields in the order the portal shows them. `python submission/count.py` counts every limited field.

## Project name

Fineprint - a summary of the terms, with money on it

## Project tag

Marketplaces

## Tag 1

Fulfillment Review

## Tag 2

Service Escrow

## Icon

`submission/fineprint-icon-512.png` (512 × 512, the site's own mark, safe for a circular crop)

## One-liner

A bond behind a summary of terms: validators read each claim against its clause.

## Description

Fineprint is a summary bond for terms and rules on GenLayer. Anyone publishes a plain-language summary of a terms document whose clauses are fixed on chain by their hash. Each claim cites a clause and is backed by a bond. Anyone can stake a tenth of the bond to challenge one claim; validators read the claim against the clause and agree on one label, faithful, misstates or unsupported. The contract derives the verdict from that label, so a challenge that lands pays the challenger from the bond and a failed one pays the author. Only withdraw pays. Deployed on Studio Next, with the golden cases run through real consensus and published as they came out: 8 of 10, both misses shown.

## Show it in action

Demo video: not recorded yet (`submission/demo-script.md` has the shot list).

## Write the exact path

### 1. Fund a wallet

Open fineprint-genlayer.vercel.app and select Connect wallet in the header, then Switch to Studio Next: the site adds GenLayer Studio Next (chain 61997) to the wallet. The first action panel you reach offers Get test GEN, which pays 20 test GEN from the site's faucet.

### 2. Open a summary

Select Summaries in the header, then Kiln airdrop terms, summary 3. Each claim sits next to its mark: pink for upheld, struck through for tested, hatched for struck, dotted for untested.

### 3. Challenge a claim

Open an untested claim's clause row, for example claim 1, then select Stake 2 GEN and challenge after writing a reason, and confirm. The panel shows what you get if the claim is upheld before you sign.

### 4. Ask the validators

On the challenge page select Ask the validators to read it and confirm. The page shows Validators are reading, then the label, the verdict and how many validators agreed.

### 5. Withdraw

Select Withdraw and confirm. Verdicts only move balances inside the contract; withdraw is the one call that pays, and the GEN lands at finality.

## Prove the path works

### Expected verification outcome

The challenge page shows the label and the verdict, the claim carries its mark on the summary, the bond is down by the bonus, and My bonds shows the balance. To confirm on chain, open the judge transaction: consensus_data.leader_receipt[0] has execution_result SUCCESS and result.status return; a refusal is also ACCEPTED, so status alone proves nothing. get_challenge(id) returns the label, verdict and payout. The same path ran from fresh accounts against the live site: https://github.com/meitipro/fineprint/blob/main/docs/reviewer-path.studio-next.json

### Contract link

https://explorer-studio-dev.genlayer.com/address/0xe6Aa698d3b3c5F6ED7722f15649B0ca85EA7d092

## Send people to it

- Website: https://fineprint-genlayer.vercel.app
- GitHub: https://github.com/meitipro/fineprint

## Steward note

The runtime header in the spec is rejected by Studio Next today (invalid_contract runner malformed), so the contract is pinned to the runner the network resolves latest to. The golden set was locked before the first run and nothing was tuned: 8 of 10, with cases 1 and 4 expected FAITHFUL and labelled MISSTATES. Seeded streams have a backlog, so open a fresh summary to test.

## Evidence

- Contract: https://explorer-studio-dev.genlayer.com/address/0xe6Aa698d3b3c5F6ED7722f15649B0ca85EA7d092
- Deploy: https://explorer-studio-dev.genlayer.com/tx/0x8b3f662aff9982077b6795e1ea3c440244a16cbbd811f0c0659d6d00bd5350e5
- Evaluation: https://github.com/meitipro/fineprint/blob/main/eval/results.md
- Mutations, 113 of 113: https://github.com/meitipro/fineprint/blob/main/docs/MUTATIONS.md
- Seed: https://github.com/meitipro/fineprint/blob/main/docs/seed.studio-next.md
- Reviewer path on the live site: https://github.com/meitipro/fineprint/blob/main/docs/reviewer-path.studio-next.json
