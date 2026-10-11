/**
 * Baseline Swine Biosecurity Declaration Questions
 * INNSCOR AFRICA LTD(Colcom Foods) T/A TRIPLE C PIGS
 */

import { DynamicFormQuestion } from '../types';

export const DEFAULT_DECLARATION_QUESTIONS: DynamicFormQuestion[] = [
  {
    id: 'q_baseline_1',
    prompt: 'Have You been in Contact with any cloven hoofed animal in the last 72 hours?',
    type: 'BOOLEAN',
    required: true,
    order: 1,
    triggerRedAlertOn: 'TRUE',
    failureMessage:
      'CRITICAL QUARANTINE BREACH: Cloven-hoofed animal contact declared within last 72 hours. High biosecurity pathogen vector risk. Entry prohibited into Triple C Pigs production zone.',
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: true,
  },
  {
    id: 'q_baseline_2',
    prompt: 'Are you carrying any meat or Meat Products? (Search Vehicles for meat products).',
    type: 'BOOLEAN',
    required: true,
    order: 2,
    triggerRedAlertOn: 'TRUE',
    failureMessage:
      'CONTRABAND DETECTED: Carrying uncertified meat or meat products into pig production boundaries is strictly prohibited under Innscor Biosecurity Policy Sec 4.2.',
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: true,
  },
  {
    id: 'q_baseline_3',
    prompt: "Is your name on the visitors' register ?",
    type: 'BOOLEAN',
    required: true,
    order: 3,
    triggerRedAlertOn: 'FALSE',
    failureMessage:
      "VISITOR REGISTER HOLD: Visitor name or identity is not pre-approved on the Triple C Pigs authorized entry register. Security manager sign-off required.",
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: true,
  },
  {
    id: 'q_baseline_4',
    prompt:
      'Have you visited any livestock auction yards, commercial abattoirs, or bushmeat markets in the past 7 days?',
    type: 'BOOLEAN',
    required: true,
    order: 4,
    triggerRedAlertOn: 'TRUE',
    failureMessage:
      'HIGH BIOSECURITY RISK: Prior exposure to high-density animal aggregation centers within 7 days. Vehicle & footwear chemical decontamination required.',
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: false,
  },
  {
    id: 'q_baseline_5',
    prompt: 'Visitor Digital Signature Confirmation',
    type: 'SIGNATURE',
    required: false,
    order: 5,
    triggerRedAlertOn: 'NONE',
    failureMessage: 'Digital legal declaration signature is optional.',
    category: 'BIOSECURITY',
    isActive: true,
    isBaseline: true,
  },
];

export function getInitialDeclarationAnswers(
  questions: DynamicFormQuestion[] = DEFAULT_DECLARATION_QUESTIONS
): Record<string, boolean | string> {
  const answers: Record<string, boolean | string> = {};
  questions.forEach((q) => {
    if (q.type === 'BOOLEAN') {
      if (q.prompt.toLowerCase().includes('register')) {
        answers[q.id] = true; // Default: assumed on register
      } else {
        answers[q.id] = false; // Default: clean (no animal contact, no meat)
      }
    }
  });
  return answers;
}
