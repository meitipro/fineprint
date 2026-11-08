# Mutations

Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. 113 defences in
`contracts/fineprint.py` were each broken on their own, and every mutant was caught. Each row
names the first test that failed against it, read from pytest's report rather than an exit code.
The generated-copy and deployed-record tests are excluded, because they fail for any edit at all.

| # | defence broken | caught by |
|---|---|---|
| 1 | retract: anyone may retract | `tests/test_direct.py::test_only_the_author_retracts_and_only_a_challenged_claim` |
| 2 | retract: the author compared as case-sensitive text | `tests/test_direct.py::test_the_author_retracts_a_challenged_claim_before_it_is_read` |
| 3 | register: the registrar is recorded as nobody | `tests/test_direct.py::test_register_stores_the_document_under_the_hash_of_its_text` |
| 4 | post: the author is recorded as nobody | `tests/test_direct.py::test_post_summary_takes_the_bond_and_opens_the_window` |
| 5 | challenge: the challenger is recorded as nobody | `tests/test_direct.py::test_a_challenge_stakes_exactly_a_tenth_of_the_bond` |
| 6 | decide: the caller of judge is not recorded | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 7 | close: the caller is not recorded | `tests/test_direct.py::test_a_clean_window_stands_and_the_bond_returns_to_the_author` |
| 8 | close: the bond goes to the caller, not the author | `tests/test_direct.py::test_a_clean_window_stands_and_the_bond_returns_to_the_author` |
| 9 | withdraw: pays a fixed address | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 10 | register: a document can be registered twice | `tests/test_direct.py::test_a_document_cannot_be_registered_twice_and_nobody_can_edit_it` |
| 11 | register: the id ignores the title | `tests/test_direct.py::test_the_id_is_the_hash_of_the_title_and_the_clauses_and_nothing_else` |
| 12 | register: the id has no length prefixes | `tests/test_direct.py::test_a_line_break_inside_a_clause_cannot_move_a_boundary` |
| 13 | register: the text is not normalised before hashing | `tests/test_direct.py::test_the_text_is_normalised_before_it_is_hashed` |
| 14 | register: two clauses are enough | `tests/test_direct.py::test_the_limits_of_a_document` |
| 15 | register: thirteen clauses are allowed | `tests/test_direct.py::test_the_limits_of_a_document` |
| 16 | register: a 501 character clause is allowed | `tests/test_direct.py::test_the_limits_of_a_document` |
| 17 | register: an 81 character title is allowed | `tests/test_direct.py::test_the_limits_of_a_document` |
| 18 | register: an empty clause is allowed | `tests/test_direct.py::test_the_limits_of_a_document` |
| 19 | post: a bond under 10 GEN | `tests/test_direct.py::test_the_bond_is_at_least_ten_gen` |
| 20 | post: no bond check | `tests/test_direct.py::test_the_bond_is_at_least_ten_gen` |
| 21 | post: a 23 hour window | `tests/test_direct.py::test_the_window_is_24_to_168_hours` |
| 22 | post: a 169 hour window | `tests/test_direct.py::test_the_window_is_24_to_168_hours` |
| 23 | post: two claims are enough | `tests/test_direct.py::test_a_summary_has_three_to_eight_claims_each_citing_a_clause_of_the_document` |
| 24 | post: nine claims are allowed | `tests/test_direct.py::test_a_summary_has_three_to_eight_claims_each_citing_a_clause_of_the_document` |
| 25 | post: a 201 character claim | `tests/test_direct.py::test_a_summary_has_three_to_eight_claims_each_citing_a_clause_of_the_document` |
| 26 | post: a claim may cite a clause the document does not have | `tests/test_direct.py::test_a_summary_has_three_to_eight_claims_each_citing_a_clause_of_the_document` |
| 27 | post: a claim may cite clause zero | `tests/test_direct.py::test_a_summary_has_three_to_eight_claims_each_citing_a_clause_of_the_document` |
| 28 | post: a boolean is a clause number | `tests/test_direct.py::test_the_window_is_24_to_168_hours` |
| 29 | post: an unknown document | `tests/test_direct.py::test_a_summary_needs_a_registered_document` |
| 30 | post: the window starts at zero | `tests/test_direct.py::test_post_summary_takes_the_bond_and_opens_the_window` |
| 31 | post: the stake is a fifth of the bond | `tests/test_direct.py::test_post_summary_takes_the_bond_and_opens_the_window` |
| 32 | post: the bond is not counted as received | `tests/test_direct.py::test_post_summary_takes_the_bond_and_opens_the_window` |
| 33 | post: the bond is not counted as held | `tests/test_direct.py::test_post_summary_takes_the_bond_and_opens_the_window` |
| 34 | post: the summary is not listed on its document | `tests/test_direct.py::test_post_summary_takes_the_bond_and_opens_the_window` |
| 35 | challenge: any stake is accepted | `tests/test_direct.py::test_a_challenge_stakes_exactly_a_tenth_of_the_bond` |
| 36 | challenge: a stake that is too small is accepted | `tests/test_direct.py::test_a_challenge_stakes_exactly_a_tenth_of_the_bond` |
| 37 | challenge: a stake that is too large is accepted | `tests/test_direct.py::test_a_challenge_stakes_exactly_a_tenth_of_the_bond` |
| 38 | challenge: open after the window | `tests/test_direct.py::test_the_window_closes_the_door_on_new_challenges` |
| 39 | challenge: open on the last second after the window | `tests/test_direct.py::test_the_window_closes_the_door_on_new_challenges` |
| 40 | challenge: a claim that does not exist | `tests/test_direct.py::test_a_challenge_names_one_claim_that_exists` |
| 41 | challenge: an upheld claim can be upheld again | `tests/test_direct.py::test_a_rejected_claim_can_be_challenged_again_but_an_upheld_one_cannot` |
| 42 | challenge: a struck claim can be challenged | `tests/test_direct.py::test_the_author_retracts_a_challenged_claim_before_it_is_read` |
| 43 | challenge: two open challenges on one claim | `tests/test_direct.py::test_a_claim_has_one_challenge_at_a_time` |
| 44 | challenge: a clause the document does not have | `tests/test_direct.py::test_a_challenge_may_point_at_a_second_clause_of_the_document` |
| 45 | challenge: the cited clause named again is a second clause | `tests/test_direct.py::test_a_challenge_may_point_at_a_second_clause_of_the_document` |
| 46 | challenge: no reason needed | `tests/test_direct.py::test_the_reason_is_required_and_bounded` |
| 47 | challenge: a 301 character reason | `tests/test_direct.py::test_the_reason_is_required_and_bounded` |
| 48 | challenge: the stake is not held | `tests/test_direct.py::test_a_challenge_stakes_exactly_a_tenth_of_the_bond` |
| 49 | challenge: the stake is not counted as received | `tests/test_direct.py::test_a_challenge_stakes_exactly_a_tenth_of_the_bond` |
| 50 | challenge: the claim is not marked as waiting | `tests/test_direct.py::test_a_challenge_stakes_exactly_a_tenth_of_the_bond` |
| 51 | challenge: the open count is not raised | `tests/test_direct.py::test_a_challenge_stakes_exactly_a_tenth_of_the_bond` |
| 52 | judge: a challenge is read twice | `tests/test_direct.py::test_a_challenge_is_read_once` |
| 53 | judge: validators agree with any answer | `tests/test_direct.py::test_validators_compare_the_label_and_nothing_else` |
| 54 | judge: validators compare the whole answer | `tests/test_static.py::test_the_validator_compares_the_label_and_nothing_else` |
| 55 | judge: an unreadable label defaults to FAITHFUL | `tests/test_direct.py::test_read_answer_refuses_what_is_not_one_of_three_labels[{}]` |
| 56 | judge: no retry on a formatting slip | `tests/test_direct.py::test_an_unreadable_answer_is_retried_once_and_then_refused_as_an_llm_error` |
| 57 | judge: FAITHFUL is upheld | `tests/test_direct.py::test_faithful_is_rejected_and_the_stake_goes_to_the_author` |
| 58 | judge: UNSUPPORTED is rejected | `tests/test_direct.py::test_unsupported_is_upheld_too` |
| 59 | judge: past the deadline the model still runs | `tests/test_direct.py::test_a_challenge_nobody_could_read_is_voided_after_48_hours_and_the_stake_returns` |
| 60 | judge: the deadline is 72 hours | `tests/test_direct.py::test_a_challenge_nobody_could_read_is_voided_after_48_hours_and_the_stake_returns` |
| 61 | judge: a voided stake is not returned | `tests/test_direct.py::test_a_challenge_nobody_could_read_is_voided_after_48_hours_and_the_stake_returns` |
| 62 | judge: a voided stake goes to the author | `tests/test_direct.py::test_a_challenge_nobody_could_read_is_voided_after_48_hours_and_the_stake_returns` |
| 63 | judge: a voided claim stays marked as waiting | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 64 | decide: UPHELD pays no bonus | `tests/test_direct.py::test_the_author_may_challenge_their_own_claim_and_it_only_moves_money_inside_the_bond` |
| 65 | decide: UPHELD pays 30 percent | `tests/test_direct.py::test_the_author_may_challenge_their_own_claim_and_it_only_moves_money_inside_the_bond` |
| 66 | decide: CORRECTED pays 20 percent | `tests/test_direct.py::test_the_author_retracts_a_challenged_claim_before_it_is_read` |
| 67 | decide: the bonus is not capped at what remains | `tests/test_direct.py::test_the_bonus_is_capped_at_what_remains_of_the_bond` |
| 68 | decide: the bonus is a share of what remains, not of the original bond | `tests/test_direct.py::test_the_bonus_is_capped_at_what_remains_of_the_bond` |
| 69 | decide: the bonus is not taken out of the bond | `tests/test_direct.py::test_the_author_may_challenge_their_own_claim_and_it_only_moves_money_inside_the_bond` |
| 70 | decide: the bonus is not taken out of the bonds held | `tests/test_direct.py::test_the_author_may_challenge_their_own_claim_and_it_only_moves_money_inside_the_bond` |
| 71 | decide: UPHELD does not return the stake | `tests/test_direct.py::test_the_author_may_challenge_their_own_claim_and_it_only_moves_money_inside_the_bond` |
| 72 | decide: UPHELD pays the author | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 73 | decide: UPHELD does not mark the claim | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 74 | decide: UPHELD is not counted | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 75 | decide: REJECTED pays the challenger | `tests/test_direct.py::test_faithful_is_rejected_and_the_stake_goes_to_the_author` |
| 76 | decide: REJECTED pays nobody | `tests/test_direct.py::test_faithful_is_rejected_and_the_stake_goes_to_the_author` |
| 77 | decide: REJECTED does not mark the claim as tested | `tests/test_direct.py::test_faithful_is_rejected_and_the_stake_goes_to_the_author` |
| 78 | decide: the stake is still held after the verdict | `tests/test_direct.py::test_the_author_may_challenge_their_own_claim_and_it_only_moves_money_inside_the_bond` |
| 79 | decide: the open count is not lowered | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 80 | decide: the verdict is not recorded | `tests/test_direct.py::test_the_author_may_challenge_their_own_claim_and_it_only_moves_money_inside_the_bond` |
| 81 | decide: the label is not recorded | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 82 | credit: the owed total is not raised | `tests/test_direct.py::test_the_author_may_challenge_their_own_claim_and_it_only_moves_money_inside_the_bond` |
| 83 | credit: the earned total is not raised | `tests/test_direct.py::test_withdraw_is_a_top_level_transfer_of_the_whole_balance_to_the_caller` |
| 84 | retract: a claim with no challenge | `tests/test_direct.py::test_only_the_author_retracts_and_only_a_challenged_claim` |
| 85 | retract: a claim that does not exist | `tests/test_direct.py::test_only_the_author_retracts_and_only_a_challenged_claim` |
| 86 | retract: the challenge is settled as UPHELD | `tests/test_direct.py::test_the_author_retracts_a_challenged_claim_before_it_is_read` |
| 87 | retract: the challenge is settled as REJECTED | `tests/test_direct.py::test_the_author_retracts_a_challenged_claim_before_it_is_read` |
| 88 | retract: the claim is not struck | `tests/test_direct.py::test_the_author_retracts_a_challenged_claim_before_it_is_read` |
| 89 | retract: the correction is not counted | `tests/test_direct.py::test_the_author_retracts_a_challenged_claim_before_it_is_read` |
| 90 | close: before the window ends | `tests/test_direct.py::test_a_clean_window_stands_and_the_bond_returns_to_the_author` |
| 91 | close: on the last second of the window | `tests/test_direct.py::test_a_clean_window_stands_and_the_bond_returns_to_the_author` |
| 92 | close: with a challenge still open | `tests/test_direct.py::test_a_summary_with_an_open_challenge_cannot_close_until_it_is_read` |
| 93 | close: twice | `tests/test_direct.py::test_a_clean_window_stands_and_the_bond_returns_to_the_author` |
| 94 | close: the summary does not stand | `tests/test_direct.py::test_a_clean_window_stands_and_the_bond_returns_to_the_author` |
| 95 | close: the bond is not emptied | `tests/test_direct.py::test_retracting_after_the_window_still_works_while_the_challenge_is_open` |
| 96 | close: the bonds held are not lowered | `tests/test_direct.py::test_retracting_after_the_window_still_works_while_the_challenge_is_open` |
| 97 | close: the bond is not credited | `tests/test_direct.py::test_retracting_after_the_window_still_works_while_the_challenge_is_open` |
| 98 | withdraw: the balance is not cleared | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 99 | withdraw: a zero balance still sends | `tests/test_direct.py::test_withdraw_is_a_top_level_transfer_of_the_whole_balance_to_the_caller` |
| 100 | withdraw: the owed total is not lowered | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 101 | withdraw: the paid total is not raised | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 102 | withdraw: the withdrawn total is not raised | `tests/test_direct.py::test_the_worked_example_of_the_spec_misstates_is_upheld` |
| 103 | prompt: the fence lets delimiters through | `tests/test_direct.py::test_a_claim_that_gives_the_judge_an_order_is_data_and_cannot_close_the_block` |
| 104 | prompt: the claim reaches the prompt unfenced | `tests/test_direct.py::test_a_claim_that_gives_the_judge_an_order_is_data_and_cannot_close_the_block` |
| 105 | prompt: the clause reaches the prompt unfenced | `tests/test_static.py::test_every_prompt_value_is_fenced_or_owned_by_the_contract` |
| 106 | prompt: the second clause reaches the prompt unfenced | `tests/test_static.py::test_every_prompt_value_is_fenced_or_owned_by_the_contract` |
| 107 | prompt: a second clause that was not named is shown | `tests/test_direct.py::test_the_judge_reads_the_claim_and_the_clause_and_never_the_reason` |
| 108 | prompt: the second clause is never shown | `tests/test_direct.py::test_a_second_clause_named_by_the_challenger_is_added_as_its_own_fenced_block` |
| 109 | prompt: the reason is given to the judge | `tests/test_direct.py::test_the_author_may_challenge_their_own_claim_and_it_only_moves_money_inside_the_bond` |
| 110 | prompt: the wrong clause is cited | `tests/test_direct.py::test_the_judge_reads_the_claim_and_the_clause_and_never_the_reason` |
| 111 | view: a summary is found by its position, not its id | `tests/test_direct.py::test_several_summaries_can_be_written_about_one_document` |
| 112 | view: an unknown summary raises | `tests/test_direct.py::test_a_challenge_names_one_claim_that_exists` |
| 113 | view: the totals are missing | `tests/test_direct.py::test_post_summary_takes_the_bond_and_opens_the_window` |
