#!/usr/bin/env npx tsx
/**
 * ENGINE 1: SYNC SCHEMES
 * ─────────────────────────────────────────────────────────────────
 * Run: npm run mf:schemes
 *
 * Uses a curated hardcoded list of 1,534 scheme codes (same approach
 * as the original project). Fetches scheme metadata from mfapi.in
 * and upserts into the `schemes` table in Supabase.
 *
 * No DB query needed to get the list — no 1,000 row limit issues.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const MFAPI  = 'https://api.mfapi.in/mf'
const CHUNK  = 500
const DELAY  = 80   // ms between requests

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Curated scheme list — 1,534 unique codes across 57 categories ──────────────

const SCHEME_CODES = [
  // ─── LARGE CAP (63 funds)
  100219,  // JM Large Cap Fund (Regular) - Growth Option
  100382,  // UTI Large Cap Fund-Growth Option
  100471,  // Franklin India Large Cap Fund-Growth
  100475,  // Tata Large Cap Fund -Regular Plan - Growth Option
  100651,  // UTI Large Cap Fund - Regular Plan - Growth Option
  101209,  // Taurus Large Cap Fund - Regular Plan - Growth
  101594,  // HSBC Large Cap Fund - Regular Growth
  101635,  // DSP Large Cap Fund - Regular Plan - Growth
  102000,  // HDFC Large Cap Fund - Growth Option - Regular Plan
  102481,  // JM Large Cap Fund-Growth
  103174,  // Aditya Birla Sun Life Large Cap Fund-Growth
  103504,  // SBI Large Cap FUND-REGULAR PLAN GROWTH
  103747,  // Reliance Focused Large Cap Fund-Growth Plan-Growth Option
  105872,  // DSP BlackRock Top 100 Equity Fund - Institutional  Plan - Growth
  106237,  // Reliance Top 200  Fund-Institutional Plan Growth Plan Growth Option
  106871,  // LIC MF Large Cap Fund-Regular Plan-Growth
  107338,  // LIC NOMURA MF TOP 100 FUND - GROWTH OPTION
  107578,  // Mirae Asset Large Cap Fund - Growth Plan
  108466,  // ICICI Prudential Large Cap Fund (erstwhile Bluechip Fund)  - Growth
  108467,  // ICICI Prudential Bluechip Fund - Institutional Option - I - Growth
  108799,  // BANDHAN Large Cap Fund - Regular Plan - Growth
  111381,  // Principal Emerging Bluechip Fund - Growth Option
  111935,  // Edelweiss Large Cap Fund -Plan B - Growth option
  111937,  // Edelweiss Large Cap Fund -Plan C - Growth option
  111940,  // Edelweiss Large Cap Fund - Regular Plan - Growth Option
  112098,  // Invesco India Largecap Fund - Regular Plan - Growth
  112277,  // Axis Large Cap Fund - Regular Plan - Growth
  112943,  // Baroda Large cap Fund - Plan A - Growth Option
  113221,  // CANARA ROBECO LARGE CAP FUND - REGULAR PLAN - GROWTH OPTION
  113544,  // BNP PARIBAS LARGE CAP Fund-Growth Option
  114458,  // Kotak Large Cap Fund - Growth
  116547,  // Groww Largecap Fund (formerly known as Indiabulls Blue Chip Fund) - Re
  117311,  // IDBI India Top 100 Equity Fund Growth
  118069,  // L&T India Large Cap Fund - Regular Plan - Growth
  129695,  // Sundaram Top 100 Series I Regular Plan Growth
  129889,  // Sundaram Top 100 Series II Regular Plan Growth
  129988,  // JPMorgan India Top 100 Fund - Regular Plan - Growth Option
  130348,  // Sundaram Top 100 Series III Regular Plan Growth
  133353,  // Sundaram Top 100 Series IV Regular Plan Growth
  133588,  // Sundaram Top 100 Series V Regular Plan Growth
  134002,  // DWS Large Cap Fund - Series 1 - Regular Plan - Growth
  134133,  // DWS Large Cap Fund - Series 2 - Regular Plan - Growth
  134415,  // DWS Large Cap Fund - Series 3 - Regular Plan - Growth
  138308,  // PGIM India Large Cap Fund - Growth
  138310,  // DHFL Pramerica Large Cap Fund Wealth Plan - Growth Option
  138987,  // DHFL Pramerica Large Cap Fund - Series 1 - Regular Plan - Growth
  138990,  // PGIM India Large Cap Fund - Series 2 - Regular Plan - Growth
  139019,  // DHFL Pramerica Large Cap Fund - Series 3 - Regular Plan - Growth
  140578,  // Sundaram Top 100 Series VI Regular Plan Growth
  140749,  // SUNDARAM TOP 100 SERIES VII REGULAR PLAN GROWTH
  141247,  // Union Largecap Fund - Regular Plan - Growth Option
  146551,  // Mahindra Manulife Large Cap Fund - Regular Plan - Growth
  148351,  // ITI Large Cap Fund - Regular Plan - Growth Option
  148491,  // Principal Large Cap Fund - Regular Growth
  148504,  // Sundaram Large Cap Fund(Formerly Known as Sundaram Blue Chip Fund) Reg
  148982,  // BANK OF INDIA Large Cap Fund Regular Plan Growth
  149350,  // Motilal Oswal MSCI EAFE Top 100 Select Index Fund - Regular Plan Growt
  150185,  // BARODA BNP PARIBAS LARGE CAP Fund- Regular Plan - Growth Option
  150441,  // quant Large Cap Fund - Growth Option - Regular Plan
  150799,  // WhiteOak Capital Large Cap Fund Regular Plan Growth
  152780,  // BAJAJ FINSERV LARGE CAP FUND - REGULAR PLAN - GROWTH
  153238,  // Samco Large Cap Fund - Regular Plan - Growth Option
  154154,  // Parag Parikh Large Cap Fund - Regular Plan - Growth
  // ─── MID CAP (82 funds)
  100033,  // Aditya Birla Sun Life Large & Mid Cap Fund - Regular Growth
  100349,  // ICICI Prudential Large & Mid Cap Fund - Growth
  100350,  // ICICI Prudential Large & Mid Cap Fund - Institutional Option - I - Gro
  100377,  // Nippon India Growth Mid Cap Fund-Growth Plan-Growth Option
  100380,  // Nippon India Vision Large & Midcap Fund-GROWTH PLAN-Growth Option
  100473,  // Franklin India Mid Cap Fund-Growth
  100477,  // Taurus Mid Cap Fund - Regular Plan - Growth
  100664,  // UTI Large & Mid Cap Fund - Regular Plan - Growth Option
  100796,  // Sahara Midcap Fund-Growth Plan
  101065,  // quant Mid Cap Fund - Growth Option - Regular Plan
  101539,  // Sundaram Mid Cap Fund Regular Plan - Growth
  101592,  // Aditya Birla Sun Life MIDCAP Fund-Growth
  101824,  // Tata Large & Mid Cap Fund- Regular Plan - Growth Option
  102328,  // Tata Mid Cap Fund Regular Plan- Growth Option
  102394,  // UTI Mid Cap Fund-Growth Option
  102479,  // JM Mid Cap Fund-Growth
  102528,  // ICICI Prudential MidCap Fund - Growth
  102883,  // Franklin India Large & Mid Cap Fund - Growth Plan
  102920,  // CANARA ROBECO LARGE AND MID CAP FUND - REGULAR PLAN - GROWTH OPTION
  102931,  // ING Midcap Fund-Growth Option
  102941,  // SBI MIDCAP FUND - REGULAR PLAN - GROWTH
  103024,  // SBI LARGE & MIDCAP FUND- REGULAR PLAN -Growth
  103071,  // Tata Mid Cap Fund Plan A- Growth
  103234,  // Kotak Large & Midcap Fund - Growth-Regular
  103819,  // DSP Large & Mid Cap Fund - Regular Plan - Growth
  104479,  // DSP BlackRock Small and Mid Cap Fund - Institutional Plan - Growth
  104481,  // DSP Midcap Fund - Regular Plan - Growth
  104513,  // quant Large & Mid Cap Fund - Growth Option
  104908,  // Kotak Midcap Fund - Regular Plan - Growth
  105001,  // Sundaram Large and Midcap Fund Regular Plan - Growth
  105503,  // Invesco India Midcap Fund - Regular Plan - Growth Option
  105758,  // HDFC Mid Cap Fund - Growth Plan
  106144,  // Invesco India Large & Mid Cap Fund - Regular Plan - Growth
  108596,  // Bandhan Large & Mid Cap Fund - Regular Plan - Growth
  110599,  // BANK OF INDIA Large & Mid Cap Fund Eco Plan- Growth
  110603,  // BANK OF INDIA Large & Mid Cap Fund Regular Plan- Growth
  111941,  // Sundaram Mid Cap Fund Institutional Plan - Growth
  112116,  // Aditya Birla Sun Life MIDCAP Fund-Plan B (Growth)
  112496,  // L&T Mid Cap Fund-Regular Plan-Growth
  112932,  // Mirae Asset Large & Midcap Fund - Regular Plan - Growth
  113566,  // BNP Paribas Mid Cap Fund-Growth Option
  114564,  // Axis Midcap Fund - Regular Plan - Growth
  118049,  // L&T Large and Midcap Fund-Regular Plan-Growth
  125305,  // PGIM India Midcap Fund - Regular Plan - Growth Option
  127039,  // Motilal Oswal Midcap Fund-Regular Plan-Growth Option
  130496,  // HDFC Large and Mid Cap Fund - Growth Option
  133146,  // DWS Mid Cap Fund - Series 1 - Regular Plan - Growth
  133711,  // LIC MF Large & Mid Cap Fund-Regular Plan-Growth
  135678,  // Navi Large & Midcap Fund- Regular Plan- Growth Option
  138952,  // DHFL Pramerica Mid Cap Fund - Series 1 - Regular Plan - Growth
  140172,  // Edelweiss Large & Mid Cap Fund - Regular Plan - Growth Option
  140225,  // Edelweiss Mid Cap Fund - Regular Plan - Growth Option
  140460,  // IDBI Midcap Fund Growth Regular
  142109,  // Mahindra Manulife Mid Cap Fund - Regular Plan - Growth
  145112,  // Axis Large & Mid Cap Fund - Regular Plan - Growth
  146771,  // HSBC Large & Mid Cap Fund - Regular Growth
  147479,  // Mirae Asset Midcap Fund - Regular Plan-Growth Option
  147701,  // Motilal Oswal Large and Midcap Fund - Regular Plan Growth
  147748,  // Union Large & Midcap Fund - Regular Plan - Growth Option
  147779,  // Principal Midcap Fund- Regular Plan - Growth Option
  147843,  // Mahindra Manulife Large & Mid Cap Fund - Regular Plan - Growth
  148071,  // Union Midcap Fund - Regular Plan - Growth Option
  148471,  // Baroda BNP Paribas Large and Mid Cap Fund-Regular Plan-Growth Option
  148732,  // ITI Mid Cap Fund - Regular Plan - Growth Option
  149153,  // HSBC Mid Cap Fund - Regular - Growth
  150209,  // BARODA BNP PARIBAS Mid Cap Fund - Regular Plan - Growth Option
  150402,  // BANDHAN MIDCAP FUND - GROWTH - REGULAR PLAN
  150583,  // WhiteOak Capital Mid Cap Fund Regular Plan Growth
  150812,  // JM Midcap Fund (Regular) - Growth
  150816,  // Canara Robeco Mid Cap Fund- Regular Plan- Growth Option
  151034,  // HSBC Midcap Fund - Regular Growth
  152001,  // LIC MF Mid Cap Fund-Regular Plan-Growth
  152225,  // Whiteoak Capital Large & Mid Cap Fund Regular Plan Growth
  152383,  // PGIM India Large and Midcap Fund - Regular Plan - Growth Option
  152406,  // Bajaj Finserv Large and Mid Cap Fund- Regular Plan- Growth
  152824,  // ITI Large & Midcap Fund - Regular Plan - Growth
  152943,  // Helios Large & Mid Cap Fund - Regular Plan - Growth Option
  153327,  // Helios Mid Cap Fund - Regular Plan - Growth Plan
  153533,  // Samco Large & Mid Cap Fund - Regular Plan - Growth Option
  153627,  // JM Large & Mid Cap Fund (Regular) - Growth Option
  153726,  // Bank of India Mid Cap Fund - Regular Plan Growth
  154211,  // TRUSTMF MID CAP FUND -REGULAR-GROWTH
  // ─── SMALL CAP (41 funds)
  100177,  // quant Small Cap Fund - Growth - Regular Plan
  100795,  // Sundaram Small Cap Fund Regular Plan - Growth
  102875,  // Kotak-Small Cap Fund - Growth
  103360,  // Franklin India Small Cap Fund-Growth
  105804,  // Aditya Birla Sun Life Small Cap Fund - GROWTH
  105989,  // DSP Small Cap Fund - Regular - Growth
  106821,  // ICICI Prudential Smallcap Fund - Institutional Growth
  106823,  // ICICI Prudential Smallcap Fund - Growth
  107301,  // JPMorgan India Mid and Small Cap Fund - Regular Plan - Growth Option
  108097,  // HSBC Small Cap Fund - Growth
  112064,  // Sundaram Small Cap Fund Institutional Plan - Growth
  113177,  // Nippon India Small Cap Fund - Growth Plan - Growth Option
  125350,  // Axis Small Cap Fund - Regular Plan - Growth
  125494,  // SBI Small Cap Fund - Regular Plan - Growth
  129647,  // Union Small Cap Fund - Regular Plan - Growth Option
  130502,  // HDFC Small Cap Fund - Growth Option
  141462,  // IDBI Small Cap Fund Growth Regular
  145139,  // Invesco India Smallcap Fund - Regular Plan - Growth
  145208,  // Tata Small Cap Fund-Regular Plan-Growth
  145677,  // BANK OF INDIA Small Cap Fund Regular Plan Growth
  146127,  // CANARA ROBECO SMALL CAP FUND - REGULAR PLAN - GROWTH OPTION
  146193,  // Edelweiss Small Cap Fund - Regular Plan - Growth
  147129,  // Principal Small Cap Fund - Regular Plan - Growth Option
  147920,  // ITI Small Cap Fund - Regular Plan - Growth Option
  147944,  // BANDHAN SMALL CAP FUND - REGULAR PLAN GROWTH
  148617,  // UTI Small Cap Fund - Regular Plan - Growth Option
  149020,  // PGIM India Small Cap Fund - Regular Plan - Growth Option
  150912,  // Mahindra Manulife Small Cap Fund - Regular Plan - Growth
  151133,  // HSBC Small Cap Fund - Regular Growth
  152003,  // LIC MF Small Cap Fund-Regular Plan-Growth
  152108,  // QUANTUM SMALL CAP FUND - REGULAR PLAN GROWTH OPTION
  152130,  // Baroda BNP Paribas Small Cap Fund - Regular Plan - Growth option
  152232,  // Motilal Oswal Small Cap Fund - Regular - Growth
  152612,  // JM Small Cap Fund (Regular) - Growth Option
  152940,  // TRUSTMF SMALL CAP FUND -REGULAR PLAN-GROWTH
  153198,  // Mirae Asset Small Cap Fund - Regular Plan - Growth
  153609,  // BAJAJ FINSERV SMALL CAP FUND - REGULAR - GROWTH
  153909,  // Helios Small Cap Fund - Regular Plan - Growth Option
  154102,  // Groww Small Cap Fund-Regular-Growth
  154214,  // Abakkus Small Cap Fund - Regular  Plan - Growth
  154268,  // The Wealth Company Small Cap Fund- Regular-Growth
  // ─── LARGE & MID CAP (25 funds)
  100033,  // Aditya Birla Sun Life Large & Mid Cap Fund - Regular Growth
  100349,  // ICICI Prudential Large & Mid Cap Fund - Growth
  100350,  // ICICI Prudential Large & Mid Cap Fund - Institutional Option - I - Gro
  100664,  // UTI Large & Mid Cap Fund - Regular Plan - Growth Option
  101824,  // Tata Large & Mid Cap Fund- Regular Plan - Growth Option
  102883,  // Franklin India Large & Mid Cap Fund - Growth Plan
  102920,  // CANARA ROBECO LARGE AND MID CAP FUND - REGULAR PLAN - GROWTH OPTION
  103819,  // DSP Large & Mid Cap Fund - Regular Plan - Growth
  104513,  // quant Large & Mid Cap Fund - Growth Option
  106144,  // Invesco India Large & Mid Cap Fund - Regular Plan - Growth
  108596,  // Bandhan Large & Mid Cap Fund - Regular Plan - Growth
  110599,  // BANK OF INDIA Large & Mid Cap Fund Eco Plan- Growth
  110603,  // BANK OF INDIA Large & Mid Cap Fund Regular Plan- Growth
  130496,  // HDFC Large and Mid Cap Fund - Growth Option
  133711,  // LIC MF Large & Mid Cap Fund-Regular Plan-Growth
  140172,  // Edelweiss Large & Mid Cap Fund - Regular Plan - Growth Option
  145112,  // Axis Large & Mid Cap Fund - Regular Plan - Growth
  146771,  // HSBC Large & Mid Cap Fund - Regular Growth
  147843,  // Mahindra Manulife Large & Mid Cap Fund - Regular Plan - Growth
  148471,  // Baroda BNP Paribas Large and Mid Cap Fund-Regular Plan-Growth Option
  152225,  // Whiteoak Capital Large & Mid Cap Fund Regular Plan Growth
  152406,  // Bajaj Finserv Large and Mid Cap Fund- Regular Plan- Growth
  152943,  // Helios Large & Mid Cap Fund - Regular Plan - Growth Option
  153533,  // Samco Large & Mid Cap Fund - Regular Plan - Growth Option
  153627,  // JM Large & Mid Cap Fund (Regular) - Growth Option
  // ─── FLEXI CAP (47 funds)
  100313,  // LIC MF Flexi Cap Fund-Regular Plan-Growth
  100476,  // Taurus Flexi Cap Fund - Regular Plan - Growth
  100520,  // Franklin India Flexi Cap Fund - Growth
  100669,  // UTI - Flexi Cap Fund-Growth Option
  101762,  // HDFC Flexi Cap Fund - Growth Plan
  101922,  // CANARA ROBECO FLEXICAP FUND - REGULAR PLAN - GROWTH OPTION
  102252,  // HSBC Flexi Cap Fund - Regular Growth
  103166,  // Aditya Birla Sun Life Flexi Cap Fund - Growth - Regular Plan
  103215,  // SBI Flexicap Fund - REGULAR PLAN -Growth Option
  103457,  // UTI Bluechip Flexicap Fund - Regular Plan - Growth option
  105875,  // DSP Flexi Cap Fund - Regular Plan - Growth
  108594,  // BANDHAN Flexi Cap Fund - Regular Plan - Growth
  109522,  // JM Flexicap Fund (Regular) - Growth option
  109830,  // quant Flexi Cap Fund - Growth Option - Regular Plan
  112090,  // Kotak Flexicap Fund - Growth
  115270,  // Union Flexi Cap Fund - Growth Option
  118043,  // L&T Flexicap Fund-Regular Plan-Growth
  122640,  // Parag Parikh Flexi Cap Fund - Regular Plan - Growth
  128235,  // IDBI FLEXI CAP FUND Growth Regular
  129048,  // Motilal Oswal Flexi Cap Fund Regular Plan-Growth Option
  133836,  // PGIM India Flexi Cap Fund - Regular Plan - Growth Option
  140355,  // Edelweiss Flexi Cap Fund - Regular Plan - Growth Option
  141927,  // Axis Flexi Cap Fund - Regular Plan - Growth
  143787,  // Navi Flexi Cap Fund - Regular Plan - Growth
  144548,  // Tata Flexi Cap Fund -Regular Plan-Growth
  144902,  // Shriram Flexi Cap Fund - Regular Growth
  148405,  // BANK OF INDIA Flexi Cap Fund Regular Plan -Growth
  148989,  // ICICI Prudential Flexicap Fund - Growth
  149089,  // Nippon India Flexi Cap Fund - Regular Plan - Growth Plan - Growth Opti
  149101,  // Mahindra Manulife Flexi Cap Fund - Regular Plan -Growth
  149449,  // Samco Flexi Cap Fund - Regular Plan - Growth Option
  149766,  // Invesco India Flexi Cap Fund - Regular Plan - Growth
  150347,  // WhiteOak Capital Flexi Cap Fund Regular Plan-Growth
  150385,  // Baroda BNP Paribas Flexi Cap Fund - Regular Plan - Growth Option
  150568,  // Sundaram Flexicap Fund Regular Growth
  151377,  // ITI Flexi Cap Fund- Regular Plan- Growth
  151414,  // Mirae Asset Flexi Cap Fund - Regular Plan - Growth
  151799,  // 360 ONE FLEXICAP FUND-REGULAR PLAN- GROWTH
  151898,  // Bajaj Finserv Flexi Cap Fund -Regular Plan-Growth
  151920,  // NJ Flexi Cap Fund - Regular Plan - Growth Option
  152136,  // Helios Flexi Cap Fund - Regular Plan - Growth Option
  152582,  // TRUSTMF Flexi Cap Fund-Regular Plan- Growth
  153542,  // Unifi Flexi Cap Fund - Regular Growth
  153739,  // CAPITALMIND FLEXI CAP FUND REGULAR GROWTH
  153870,  // THE WEALTH COMPANY FLEXI CAP FUND - REGULAR GROWTH
  154041,  // Abakkus Flexi Cap Fund - Regular - Growth
  154226,  // Old Bridge Flexi Cap Fund Regular Growth
  // ─── MULTI CAP (38 funds)
  100631,  // quant Multi Cap Fund-GROWTH OPTION - Regular Plan
  101161,  // Nippon India Multi Cap Fund-Growth Plan-Growth Option
  101228,  // ICICI Prudential Multicap Fund - Growth
  102020,  // Baroda BNP Paribas MULTI CAP FUND - Regular Plan - Growth Option
  103335,  // Principal Focused Multicap Fund-Growth Option
  106253,  // Reliance Multi Cap Fund Institutional Plan Growth Plan Growth Option
  107353,  // Invesco India Multicap Fund - Regular Plan - Growth Option
  113460,  // BNP PARIBAS MULTI CAP Fund-Growth Option
  131163,  // UTI Multi Cap Fund - Growth Option
  141224,  // Mahindra Manulife Multi Cap Fund - Regular Plan - Growth
  143830,  // Sundaram Multi Cap Fund Series I Regular Plan - Growth
  144197,  // Sundaram Multi Cap Fund Series II Regular Plan - Growth
  147184,  // ITI Multi Cap Fund - Regular Plan - Growth Option
  149182,  // Kotak Multicap Fund-Regular Plan-Growth
  149305,  // BANDHAN MULTI CAP FUND - GROWTH - REGULAR PLAN
  149366,  // HDFC Multi Cap Fund - Growth Option
  149382,  // Axis Multicap Fund - Regular Plan - Growth
  149532,  // Sundaram Focused Fund (Formerly Known as Principal Focused Multicap Fu
  149667,  // Sundaram Multi Cap Fund (Formerly Known as Principal Multi Cap Growth
  149886,  // SBI Multicap Fund- Regular Plan- Growth Option
  150661,  // LIC MF Multi Cap Fund-Regular Plan-Growth
  150855,  // Union Multicap Fund - Regular Plan - Growth Option
  151235,  // Tata Multicap Fund - Regular Plan - Growth
  151289,  // HSBC Multi Cap Fund - Regular - Growth
  151445,  // Bank of India Multi Cap Fund Regular Plan - Growth
  151812,  // Mirae Asset Multicap Fund - Regular Plan - Growth
  151821,  // Canara Robeco Multi Cap Fund - Regular Plan - Growth Option
  152072,  // WhiteOak Capital Multi Cap Fund Regular Plan Growth
  152095,  // Edelweiss Multi Cap Fund - Regular Plan - Growth
  152307,  // DSP Multicap Fund - Regular - Growth
  152650,  // Motilal Oswal Multi Cap Fund Regular Plan Growth
  152738,  // Franklin India Multi Cap Fund - Growth
  152816,  // PGIM India Multi Cap Fund - Regular Plan - Growth Option
  152848,  // Samco Multi Cap Fund - Regular Plan - Growth
  153100,  // Groww Multicap Fund - Regular - Growth
  153307,  // BAJAJ FINSERV MULTI CAP FUND - REGULAR - GROWTH
  153516,  // UTI Multi Cap Fund - Regular Plan - Growth Option
  153645,  // TRUSTMF MULTI CAP FUND -REGULAR PLAN-GROWTH
  // ─── FOCUSED FUND (38 funds)
  102756,  // SBI FOCUSED FUND - REGULAR PLAN -GROWTH
  102760,  // HDFC Focused Fund - GROWTH PLAN
  103309,  // Aditya Birla Sun Life Focused Fund -Growth Option
  104637,  // Nippon India Focused Fund -Growth Plan -Growth Option
  105817,  // Franklin India Focused Equity Fund - Growth Plan
  107410,  // JM Focused Fund (Regular) - Growth Option
  108592,  // Bandhan Focused Fund - Regular Plan - Growth
  109275,  // quant Focused Fund - Growth Option - Regular Plan
  111957,  // ICICI Prudential Focused Equity Fund - Growth
  111959,  // ICICI Prudential Focused Equity Fund Institutional Growth
  112901,  // DSP Focused Fund - Regular Plan - Growth
  117560,  // Axis Focused Fund - Regular Plan - Growth Option
  122387,  // Motilal Oswal Focused Fund - Regular Plan Growth Option
  126638,  // Aditya Birla Sun Life Focused Equity Fund - Series 1 - Regular Plan-Gr
  127921,  // Aditya Birla Sun Life Focused Equity Fund - Series 2 - Regular Plan-Gr
  131527,  // Aditya Birla Sun Life Focused Equity Fund - Series 3 - Regular Plan -
  131578,  // 360 ONE Focused Fund -Regular Plan - Growth
  133102,  // Aditya Birla Sun Life Focused Equity Fund - Series 4 - Regular Plan -
  133527,  // HDFC FOCUSED EQUITY FUND - Regular Plan - Growth Option
  133896,  // Aditya Birla Sun Life Focused Equity Fund - Series 5 - Regular Plan -
  134336,  // HDFC Focused Equity Fund - Plan B - Regular Plan - Growth Option
  135349,  // Aditya Birla Sun Life Focused Equity Fund - Series 6 - Regular Plan-Gr
  145378,  // L&T Focused Equity Fund - Regular Plan - Growth Option
  147203,  // Mirae Asset Focused Fund Regular Plan Growth
  147477,  // Kotak Focused Fund- Regular plan _ Growth Option
  147490,  // Union Focused Fund - Regular Plan - Growth Option
  147760,  // Tata Focused Fund-Regular Plan-Growth
  148409,  // HSBC Focused Fund - Regular Growth
  148483,  // Invesco India Focused Fund - Regular Plan - Growth
  148571,  // Mahindra Manulife Focused Fund - Regular Plan - Growth
  148884,  // Canara Robeco Focused Fund - Regular Plan - Growth Option
  149090,  // UTI Focused Fund - Regular Plan - Growth Option
  149532,  // Sundaram Focused Fund (Formerly Known as Principal Focused Multicap Fu
  150263,  // BARODA BNP PARIBAS Focused Fund - Regular Plan-Growth Option
  150382,  // Edelweiss Focused Fund - Regular Plan - Growth
  151778,  // ITI Focused Fund - Regular Plan - Growth
  152009,  // LIC MF Focused Fund-Regular Plan-Growth
  152361,  // Old Bridge Focused Fund - Regular Growth
  // ─── ELSS (51 funds)
  100175,  // quant ELSS Tax Saver Fund - Growth Option - Regular Plan
  100354,  // ICICI Prudential ELSS Tax Saver Fund - Growth
  100480,  // Taurus ELSS Tax Saver Fund - Regular Plan - Growth
  100526,  // Franklin India ELSS Tax Saver Fund-Growth
  100821,  // UTI ELSS Tax Saver Fund - Regular Plan - Growth Option
  100865,  // LIC MF ELSS Tax Saver-Regular Plan-Growth
  101979,  // HDFC ELSS Tax saver - Growth Plan
  103196,  // Nippon India ELSS Tax Saver Fund-Growth Plan-Growth Option
  103339,  // Kotak ELSS Tax Saver Fund-Growth
  103445,  // ABN AMRO Tax  Advantage Plan (ELSS)-Growth Option
  104636,  // Invesco India ELSS Tax Saver Fund - Regular Plan - Growth
  104640,  // JM Equity Tax Saver Fund - Series I - Growth Plan
  104772,  // DSP ELSS Tax Saver Fund - Regular Plan - Growth
  105156,  // Standard Chartered Tax Saver (ELSS) Fund A GROWTH
  105317,  // Principal Pnb Long Term Equity Fund - Growth Option
  105628,  // SBI ELSS Tax Saver FUND - REGULAR PLAN- GROWTH
  106722,  // Principal Pnb Long Term Equity Fund 3 Year Plan Series II - Growth Opt
  107288,  // JM ELSS Tax Saver Fund (Regular) - Growth option
  107745,  // Aditya Birla Sun Life ELSS Tax Saver Fund - Growth Option
  108865,  // IDFC Tax Saver (ELSS) Fund A GROWTH
  110751,  // Fortis Tax  Advantage Plan (ELSS)-Growth Option
  111569,  // BANDHAN ELSS Tax Saver Fund - Regular Plan - Growth
  111638,  // Edelweiss ELSS Tax Saver Fund - Regular Plan - Growth Option
  111709,  // BANK OF INDIA ELSS Tax Saver -ECO Plan-Growth
  111710,  // BANK OF INDIA ELSS Tax Saver -Regular Plan- Growth
  111722,  // CANARA ROBECO ELSS TAX SAVER - REGULAR PLAN - GROWTH OPTION
  112323,  // Axis ELSS Tax Saver Fund - Regular Plan - Growth
  112538,  // L&T Tax Saver Fund-Regular Plan - Growth
  113463,  // BNP Paribas Long Term Equity Fund - Growth Option
  116051,  // Union ELSS Tax Saver Fund - Growth Option
  132757,  // Tata ELSS Fund-Growth-Regular Plan
  133385,  // Motilal Oswal ELSS Tax Saver Fund - Regular Plan - Growth Option
  134044,  // Baroda ELSS 96 Plan A -Growth Option
  135598,  // PGIM India ELSS Tax Saver Fund - Regular Plan - Growth Option
  135655,  // Navi ELSS Tax Saver Fund- Regular Plan- Growth Option
  135784,  // Mirae Asset ELSS Tax Saver Fund - Regular Plan - Growth
  139783,  // Mahindra Manulife ELSS Tax Saver Fund- Regular Plan - Growth
  141070,  // Quantum ELSS Tax Saver Fund - Regular Plan Growth Option
  141862,  // Groww ELSS Tax Saver Fund (formerly known as Indiabulls Tax Savings Fu
  145820,  // Shriram ELSS Tax Saver Fund - Regular Growth
  147482,  // Parag Parikh ELSS Tax Saver Fund- Regular Growth
  147544,  // ITI ELSS Tax Saver Fund - Regular Plan - Growth Option
  149569,  // Sundaram ELSS Tax Saver Fund Regular Growth
  150156,  // BARODA BNP PARIBAS ELSS Tax Saver Fund - Regular - Growth Option
  150589,  // WhiteOak Capital ELSS Tax Saver Fund Regular Plan Growth
  150839,  // Samco ELSS Tax Saver Fund - Regular Plan - Growth Option
  151076,  // HSBC ELSS Tax saver Fund - Regular Growth
  151164,  // 360 ONE ELSS Tax Saver Nifty 50 Index Fund - Regular Plan - Growth
  151472,  // NAVI ELSS TAX SAVER NIFTY 50 INDEX FUND - REGULAR PLAN GROWTH
  151609,  // NJ ELSS Tax Saver Scheme Regular Growth
  153202,  // BAJAJ FINSERV ELSS TAX SAVER FUND - REGULAR - GROWTH
  // ─── VALUE/CONTRA (44 funds)
  100254,  // JM Value Fund (Regular) - Growth Option
  100496,  // Templeton India Value Fund - Growth Plan
  100751,  // UTI - Master Value Fund-Growth Option
  101672,  // Tata Value Fund - Regular Plan -Growth Option
  101764,  // HDFC Value Fund - Growth Plan
  101853,  // Sundaram Value Fund Regular Plan - Growth
  102414,  // SBI CONTRA FUND - REGULAR PLAN -GROWTH
  102494,  // UTI - GROWTH & VALUE FUND-GROWTH
  102594,  // ICICI Prudential Value Fund (erstwhile Value Discovery Fund) - Growth
  103040,  // Kotak Contra Fund - Regular Plan - Growth
  103085,  // Nippon India Value Fund- Growth Plan
  103098,  // UTI Value Fund - Regular Plan - Growth Option
  103336,  // Tata Contra Fund Plan A -  Growth
  103534,  // UTI Contra Fund-Growth-Growth Option
  103649,  // ING Contra Fund -Growth Option
  105460,  // Invesco India Contra Fund - Regular Plan - Growth
  106147,  // JM Contra Fund - Growth option
  108167,  // Aditya Birla Sun Life Value Fund - Growth Option
  108909,  // Bandhan Value Fund - Regular Plan - Growth
  112105,  // Sahara Star Value Fund-Growth Option
  112288,  // Fidelity India Value Fund-Growth Option
  118102,  // L&T India Value Fund-Regular Plan-Growth
  133318,  // Sundaram Value Fund Series I Regular Plan Growth
  133557,  // Sundaram Value Fund Series II Regular Plan Growth
  135343,  // Groww Value Fund (formerly known as Indiabulls Value Fund) - Regular P
  136086,  // Sundaram Value Fund Series III Regular Plan Growth
  140659,  // Sundaram Value Fund Series VII Regular Plan - Growth
  141068,  // Quantum Value Fund - Regular Plan Growth Option
  141339,  // Sundaram Value Fund Series VIII Regular Plan - Growth
  141913,  // Sundaram Value Fund Series IX Regular Plan - Growth
  141929,  // Sundaram Value Fund Series X Regular Plan - Growth
  143837,  // Tata Value Fund Series 1 Regular Plan Growth
  144212,  // Tata Value Fund Series 2 -Regular Plan-Growth
  144453,  // IDBI Long Term Value Fund-Regular Plan-Growth
  145471,  // Union Value Fund - Regular Plan - Growth Option
  148594,  // DSP Value Fund - Regular Plan - Growth
  148973,  // ITI Value Fund - Regular Plan - Growth Option
  149088,  // Canara Robeco Value Fund - Regular Plan - Growth Option
  149167,  // Axis Value Fund - Regular Plan - Growth
  149337,  // Quant Value Fund - Growth Option - Regular Plan
  151110,  // HSBC Value Fund - Regular Growth
  151747,  // Baroda BNP Paribas Value Fund - Regular Plan - Growth option
  152016,  // LIC MF Value Fund-Regular Plan-Growth
  153304,  // Mahindra Manulife Value Fund - Regular Plan - Growth
  // ─── SECTORAL BANKING (28 funds)
  101862,  // Nippon India Banking & Financial Services Fund-Growth Plan-Growth Opti
  102401,  // UTI Banking and Financial Services Fund - Regular Plan - Growth Option
  108378,  // Invesco India Financial Services Fund - Regular Plan - Growth
  109445,  // ICICI Prudential Banking and Financial Services Fund -  Growth
  109493,  // SAHARA BANKING & FINANCIAL SERVICES FUND- GROWTH OPTION
  110252,  // Reliance Banking Fund - Institutional Plan - Growth Option
  117312,  // Taurus Banking & Financial Services Fund - Regular Plan - Growth
  117549,  // Baroda BNP Paribas Banking and Financial Services Fund - Regular - Gro
  125595,  // Aditya Birla Sun Life Banking and Financial Services Fund - Regular Pl
  133858,  // SBI BANKING & FINANCIAL SERVICES FUND - REGULAR PLAN - GROWTH
  134016,  // LIC MF Banking and Financial Services Fund-Regular Plan-Growth
  135794,  // Tata Banking And Financial Services Fund-Regular Plan-Growth
  143351,  // IDBI Banking & Financial Services Fund - Regular Plan (Growth)
  148621,  // Mirae Asset Banking and Financial Services Fund Regular Growth
  148987,  // HDFC Banking & Financial Services Fund - Growth Option
  149324,  // ITI Banking and Financial Services Fund -Regular Plan - Growth Option
  151381,  // Kotak Banking & Financial Services Fund - Regular Plan - Growth
  151818,  // BANDHAN FINANCIAL SERVICES FUND - REGULAR PLAN - GROWTH
  152208,  // DSP Banking & Financial Services Fund - Regular - Growth
  152274,  // Groww Banking & Financial Services Fund - Regular - Growth
  152322,  // WhiteOak Capital Banking & Financial Services Fund - Regular Growth
  152682,  // Helios Financial Services Fund - Regular Plan - Growth Option
  153267,  // HSBC Financial Services Fund - Regular Growth
  153675,  // Mahindra Manulife Banking & Financial Services Fund - Regular - Growth
  153935,  // Bajaj Finserv Banking and Financial Services Fund - Regular - Growth
  154095,  // Bank of India Banking & Financial Services Fund - Regular Plan - Growt
  154107,  // Edelweiss Financial Services Fund - Regular Plan - Growth Option
  154137,  // Motilal Oswal Financial Services Fund- Regular-Growth
  // ─── SECTORAL TECHNOLOGY (15 funds)
  100363,  // ICICI Prudential Technology Fund - Growth
  100522,  // Franklin India Technology Fund-Growth
  101000,  // Tata Life Sciences & Technology Fund - Growth
  102969,  // Principal Deposit Fund 371 days plan-March 05-Growth
  103297,  // Principal Deposit Fund 371 days plan-Oct 05-Growth
  103332,  // Principal Deposit Fund 91 days plan-Nov 05-Growth
  148692,  // SBI Retirement Benefit Fund - Conservative Hybrid Plan - Regular Plan
  148695,  // SBI Retirement Benefit Fund - Aggressive Hybrid Plan - Regular Plan -
  148696,  // SBI Retirement Benefit Fund - Conservative Plan - Regular Plan - Growt
  148698,  // SBI Retirement Benefit Fund - Aggressive Plan - Regular Plan - Growth
  152058,  // HDFC Technology Fund - Growth Option
  152439,  // Edelweiss Technology Fund - Regular Plan - Growth
  152460,  // Kotak Technology Fund - Regular Plan - Growth Option
  152862,  // Invesco India Technology Fund - Regular Plan - Growth
  154247,  // LIC MF Technology Fund-Regular Plan-Growth
  // ─── SECTORAL PHARMA (16 funds)
  100807,  // UTI Healthcare Fund - Regular Plan - Growth Option
  100902,  // Franklin Pharma Fund - Growth
  102431,  // Nippon India Pharma Fund-Growth Plan-Growth Option
  135812,  // Tata India Pharma & Healthcare Fund-Regular Plan-Growth
  143785,  // Mirae Asset Healthcare Fund -Regular Growth
  145456,  // DSP Healthcare Fund - Regular Plan - Growth
  146518,  // IDBI Healthcare Fund - Regular Plan - Growth
  147407,  // Aditya Birla Sun Life Pharma and Healthcare Fund-Regular-Growth
  149270,  // ITI Pharma and Healthcare Fund - Regular Plan - Growth Option
  151855,  // quant Healthcare Fund - Growth Option - Regular Plan
  152025,  // LIC MF Healthcare Fund-Regular Plan-Growth
  152084,  // HDFC Pharma and Healthcare Fund - Growth Option
  152216,  // Kotak Healthcare Fund - Regular Plan - Growth Option
  153040,  // PGIM India Healthcare Fund - Regular Plan - Growth Option
  153155,  // BAJAJ FINSERV HEALTHCARE FUND - REGULAR - GROWTH
  153974,  // Bandhan Healthcare Fund - Regular Plan - Growth
  // ─── SECTORAL INFRASTRUCTURE (28 funds)
  101766,  // Tata Infrastructure Fund-Regular Plan- Growth Option
  102395,  // UTI Infrastructure Fund-Growth Option
  103149,  // ICICI Prudential Infrastructure Fund - Growth
  103390,  // CANARA ROBECO INFRASTRUCTURE FUND - REGULAR PLAN - GROWTH OPTION
  103476,  // Aditya Birla Sun Life Infrastructure Fund-Growth
  103731,  // Sahara Infrastructure Fund ---FIXED PRICING OPTION-Growth Option
  103733,  // Sahara Infrastructure Fund ---VARIABLE PRICING OPTION-Growth Option
  105417,  // Taurus Infrastructure Fund - Regular Plan - Growth
  105602,  // ICICI Prudential Infrastructure Fund - Institutional Option - I - Grow
  106096,  // SBI INFRASTRUCTURE FUND -  REGULAR PLAN - GROWTH
  106098,  // OLD-SBI INFRASTRUCTURE FUND - SERIES I REPURCHASE GROWTH (6/7/2007)
  106170,  // quant Infrastructure Fund - Growth Option
  106482,  // Tata Indo-Global Infrastructure Fund Plan A - Growth
  106654,  // Invesco India Infrastructure Fund - Regular Plan - Growth Option
  107394,  // Kotak Indo World Infrastructure Fund  - Growth
  107524,  // HDFC Infrastructure Fund - Growth Plan
  107623,  // Tata Growing Economies Infrastructure Fund Scheme A  Plan A - Growth
  107625,  // Tata Growing Economies Infrastructure Fund Scheme B Plan A - Growth
  107763,  // LIC MF Infrastructure Fund-Regular Plan-Growth
  111943,  // Reliance Infrastructure Fund -Growth Option
  111946,  // Reliance Infrastructure Fund- Institutional Plan-Growth Option
  111955,  // Aditya Birla Sun Life Infrastructure Fund-Plan B (Growth)
  112359,  // BANK OF INDIA Manufacturing & Infrastructure Fund-Growth
  112600,  // L&T Infrastructure Fund - Regular Plan - Growth
  114476,  // BANDHAN Infrastructure Fund - Regular Plan - Growth
  151037,  // HSBC Infrastructure Fund - Regular Growth
  153482,  // Motilal Oswal Infrastructure Fund-Regular-Growth
  153985,  // Mirae Asset Infrastructure Fund - Regular Plan - Growth
  // ─── SECTORAL MANUFACTURING (9 funds)
  151913,  // quant Manufacturing Fund - Growth Option - Regular Plan
  152205,  // Axis India Manufacturing Fund - Regular Plan - Growth
  152447,  // Canara Robeco Manufacturing Fund - Regular Plan - Growth Option
  152602,  // HDFC Manufacturing fund - Growth Option - Regular Plan
  152671,  // Mahindra Manulife Manufacturing Fund - Regular Plan - Growth
  152696,  // Baroda BNP Paribas Manufacturing Fund - Regular Plan - Growth Option
  152758,  // Invesco India Manufacturing Fund - Regular Plan - Growth
  152763,  // Motilal Owsal Manufacturing Fund - Regular Plan - Growth
  152922,  // LIC MF Manufacturing Fund-Regular Plan-Growth
  // ─── SECTORAL CONSUMPTION (21 funds)
  102142,  // Sundaram Consumption Fund(Formerly Known as Sundaram Rural and Consump
  102751,  // Nippon India Consumption Fund-Growth Plan-Growth Option
  103111,  // Aditya Birla Sun Life Consumption Fund-Growth Option
  112152,  // CANARA ROBECO CONSUMPTION FUND - REGULAR PLAN - GROWTH OPTION
  144636,  // BNP Paribas India Consumption Fund - Regular Plan - Growth Option
  145355,  // Mahindra Manulife Consumption Fund- Regular Plan - Growth
  146950,  // ICICI Prudential Bharat Consumption Fund - Growth Option
  150268,  // BARODA BNP PARIBAS India Consumption Fund - Regular Plan - Growth Opti
  151803,  // HDFC Consumption Fund - Growth Option
  152027,  // HSBC Consumption Fund - Regular Growth
  152170,  // Kotak Consumption Fund - Regular plan - Growth Option
  152338,  // quant Consumption Fund - Growth Option - Regular Plan
  152804,  // Axis Consumption Fund Regular Plan - Growth
  153072,  // BAJAJ FINSERV CONSUMPTION FUND - REGULAR - GROWTH
  153140,  // Bank of India Consumption Fund - Regular - Growth
  153255,  // Edelweiss Consumption Fund - Regular - Growth
  153263,  // ITI Bharat Consumption Fund - Regular Plan Plan - Growth
  153902,  // Invesco India Consumption Fund - Regular Plan - Growth Plan
  153916,  // Motilal Oswal Consumption Fund-Regular-Growth
  153950,  // LIC MF Consumption Fund-Regular Plan-Growth
  154022,  // Union Consumption Fund - Regular Plan - Growth Option
  // ─── SECTORAL ENERGY (8 funds)
  100805,  // UTI Energy Fund-Growth Option
  107636,  // Reliance Natural Resources Fund-Growth Plan-Growth Option
  108202,  // DSP Natural Resources And New Energy Fund - Regular - Growth
  108209,  // DSP BlackRock Natural Resources And New Energy Fund - Institutional Pl
  108321,  // Sahara Power & Natural resources Fund- Growth Option
  110256,  // Reliance Natural Resources Fund - Institutional Plan - Growth Option
  112128,  // DSP BlackRock World Energy Fund - Institutional Plan - Growth
  135815,  // Tata Resources & Energy Fund-Regular Plan-Growth
  // ─── THEMATIC MNC (7 funds)
  100064,  // Aditya Birla Sun Life MNC Fund - Growth - Regular Plan
  100740,  // UTI - MNC Fund - Regular Plan - Growth Option
  103034,  // SBI MNC FUND - REGULAR PLAN -GROWTH
  147345,  // ICICI Prudential MNC Fund - Growth Option
  151457,  // HDFC MNC Fund - Growth Option
  152913,  // Kotak MNC Fund-Regular Plan- Growth
  153691,  // Nippon India MNC Fund- Regular Plan-Growth Option
  // ─── THEMATIC PSU (14 funds)
  100781,  // Sundaram Banking & PSU Fund (Formerly Known as Sundaram Banking and PS
  100784,  // Sundaram Banking & PSU Fund (Formerly Known as Sundaram Banking and PS
  102404,  // UTI PSU Fund-Growth Option
  105823,  // LIC MF Banking & PSU Fund-Regular Plan-Growth
  113099,  // SBI PSU Fund - REGULAR PLAN -Growth
  118232,  // Invesco India Banking and PSU Fund - Regular Plan - Growth Option
  121280,  // Bandhan Banking and PSU Fund - Regular Growth
  125498,  // SBI BANKING & PSU FUND - Regular Paln - Growth
  126939,  // UTI Banking & PSU Fund- Regular Plan - Growth Option
  134545,  // Nippon India Banking and PSU Fund- Growth Plan- Growth Option
  148416,  // Mirae Asset Banking and PSU Fund - Regular Plan - Growth
  148655,  // TRUSTMF BANKING & PSU FUND - REGULAR GROWTH
  152165,  // Bajaj Finserv Banking and PSU Fund- Regular Plan- Growth
  152413,  // quant PSU Fund - Growth Option - Regular Plan
  // ─── INDEX NIFTY 50 (24 funds)
  100484,  // Franklin India Index Fund- NSE Nifty 50 Index Fund - Growth
  100822,  // UTI Nifty 50 Index Fund - Regular Plan - Growth Option
  101201,  // LIC MF Nifty 50 Index Fund-Regular Plan-Growth
  101314,  // Aditya Birla Sun Life Nifty 50 Index Fund - Growth - Regular Plan
  101525,  // HDFC Nifty 50 Index Fund - Growth Plan
  112877,  // BANDHAN Nifty 50 Index Fund - Regular Plan - Growth
  112948,  // Taurus Nifty 50 Index Fund - Regular Plan - Growth
  113063,  // IDBI NIFTY 50 Index Fund Growth
  146379,  // DSP Nifty 50 Index Fund - Regular Plan - Growth
  147795,  // Motilal Oswal Nifty 50 Index Fund - Regular plan - Growth
  148361,  // L&T Nifty 50 Index Fund - Regular Plan - Growth
  148974,  // Kotak Nifty 50 Index Fund - Regular Plan-Growth
  149040,  // Navi Nifty 50 Index Fund-Regular Plan-Growth
  149252,  // Edelweiss Nifty 50 Index Fund Regular Plan Growth
  149371,  // Axis Nifty 50 Index Fund - Regular Plan - Growth Option
  151158,  // HSBC NIFTY 50 INDEX FUND - Regular Growth
  151164,  // 360 ONE ELSS Tax Saver Nifty 50 Index Fund - Regular Plan - Growth
  151472,  // NAVI ELSS TAX SAVER NIFTY 50 INDEX FUND - REGULAR PLAN GROWTH
  152331,  // Baroda BNP Paribas Nifty 50 Index Fund - Regular Plan - Growth option
  152974,  // Mirae Asset Nifty 50 Index Fund - Regular Plan - Growth
  153508,  // Bajaj Finserv Nifty 50 Index Fund - Regular - Growth
  153530,  // ANGEL ONE NIFTY 50 INDEX FUND-REGULAR-GROWTH
  153710,  // Groww Nifty 50 Index Fund Regular Growth
  154302,  // Choice Nifty 50 Index Fund - Regular Plan Growth
  // ─── INDEX NIFTY NEXT 50 (22 funds)
  112957,  // ICICI Prudential Nifty Next 50 Index Fund - Growth
  113249,  // IDBI Nifty Next 50 Index Fund Growth
  143340,  // UTI Nifty Next 50 Index Fund - Regular Plan - Growth Option
  146380,  // DSP Nifty Next 50 Index Fund - Regular Plan - Growth
  146514,  // Nippon India Nifty Next 50 Junior BeES FoF - Growth Plan - Growth Opti
  147797,  // Motilal Oswal Nifty Next 50 Index Fund - Regular plan - Growth
  148365,  // L&T Nifty Next 50 Index Fund - Regular Plan - Growth Option
  148743,  // Kotak Nifty Next 50 Index Fund - Regular Plan - Growth Option
  148943,  // SBI Nifty Next 50 Index Fund - Regular Plan - Growth
  149287,  // HDFC NIFTY Next 50 Index Fund - Growth Option
  149448,  // Navi Nifty Next 50 Index Fund- Regular Plan- Growth
  149467,  // Axis Nifty Next 50 Index Fund - Regular Plan - Growth
  149837,  // Aditya Birla Sun Life Nifty Next 50 Index Fund-Regular Growth
  150477,  // HDFC NIFTY NEXT 50 ETF - Growth Option
  150897,  // Edelweiss Nifty Next 50 Index Fund - Regular Plan - Growth
  151162,  // HSBC NIFTY NEXT 50 INDEX FUND - Regular Growth
  151935,  // LIC MF Nifty Next 50 Index Fund-Regular Plan-Growth
  153349,  // Bandhan Nifty Next 50 Index Fund - Regular Plan - Growth
  153480,  // Bajaj Finserv Nifty Next 50 Index Fund - Regular - Growth
  153798,  // Groww Nifty Next 50 Index Fund Regular Growth
  153855,  // Tata Nifty Next 50 Index Fund - Regular Plan Growth Option
  154303,  // Choice Nifty Next 50 Index Fund - Regular Plan Growth
  // ─── INDEX NIFTY 100 (3 funds)
  147665,  // Axis Nifty 100 Index Fund - Regular Plan - Growth Option
  149833,  // BANDHAN NIFTY 100 INDEX FUND - REGULAR PLAN - GROWTH
  149869,  // HDFC NIFTY 100 Index Fund - Growth Option
  // ─── INDEX NIFTY 500 (4 funds)
  152730,  // Axis Nifty 500 Index Fund - Regular Plan - Growth Option
  152906,  // SBI Nifty 500 Index Fund- Regular Plan- Growth
  153162,  // ICICI Prudential Nifty 500 Index Fund - Growth
  154090,  // DSP Nifty 500 Index Fund - Regular - Growth
  // ─── INDEX NIFTY MIDCAP 150 (19 funds)
  148723,  // Nippon India Nifty Midcap 150 Index Fund - Regular Plan - Growth Optio
  148805,  // Aditya Birla Sun Life Nifty Midcap 150 Index Fund-Regular Growth
  149390,  // ICICI Prudential Nifty Midcap 150 Index Fund - Growth
  149893,  // Navi Nifty Midcap 150 Index Fund Regular Plan- Growth
  150312,  // UTI Nifty Midcap 150 Quality 50 Index Fund - Regular Plan - Growth Opt
  150427,  // DSP Nifty Midcap 150 Quality 50 Index Fund - Regular - Growth
  150672,  // SBI Nifty Midcap 150 Index Fund - Regular Plan - Growth
  150741,  // Tata Nifty Midcap 150 Momentum 50 Index Fund - Growth - Regular Plan
  150900,  // Edelweiss Nifty Midcap150 Momentum 50 Index Fund - Regular Plan - Grow
  151374,  // HDFC NIFTY Midcap 150 ETF - Growth Option
  151725,  // HDFC NIFTY Midcap 150 Index Fund - Growth Option
  152856,  // Bandhan Nifty Midcap 150 Index Fund-Regular Plan-Growth
  152918,  // Kotak Nifty Midcap 150 Momentum 50 Index Fund-Regular Plan-Growth
  153001,  // Baroda BNP Paribas Nifty Midcap 150 Index Fund - Regular Plan - Growth
  153088,  // UTI Nifty Midcap 150 Index Fund - Regular Plan - Growth Option
  153399,  // KOTAK NIFTY MIDCAP 150 INDEX FUND-REGULAR PLAN-GROWTH
  153580,  // Tata Nifty Midcap 150 Index Fund - Regular Plan - Growth Option
  153953,  // Groww Nifty Midcap 150 Index Fund Regular Growth
  154012,  // DSP Nifty Midcap 150 Index Fund - Regular - Growth
  // ─── INDEX NIFTY SMALLCAP (15 funds)
  148518,  // Nippon India Nifty Smallcap 250 Index Fund - Regular Plan - Growth Opt
  148811,  // Aditya Birla Sun Life Nifty Smallcap 50 Index Fund-Regular Growth
  149281,  // ICICI Prudential Nifty Smallcap 250 Index Fund - Growth
  149896,  // Axis Nifty Smallcap 50 Index Fund - Regular Plan - Growth Option
  150676,  // SBI Nifty Smallcap 250 Index Fund - Regular Plan - Growth
  150894,  // Edelweiss Nifty Smallcap 250 Index Fund - Regular Plan - Growth
  151375,  // HDFC NIFTY Smallcap 250 ETF - Growth Option
  151647,  // Kotak Nifty Smallcap 50 Index Fund - Regular Plan - Growth
  151726,  // HDFC NIFTY Smallcap 250 Index Fund - Growth Option
  152245,  // DSP Nifty Smallcap250 Quality 50 Index Fund - Regular - Growth
  152266,  // BANDHAN Nifty Smallcap 250 Index Fund - Regular Plan - Growth
  152433,  // Groww Nifty Smallcap 250 Index Fund - Regular Plan - Growth
  152457,  // Mirae Asset Nifty Smallcap 250 Momentum Quality 100 ETF Fund of Fund -
  153221,  // Kotak Nifty SmallCap 250 Index Fund- Regular - Growth
  154016,  // DSP Nifty Smallcap 250 Index Fund - Regular - Growth
  // ─── INDEX NIFTY MIDSMALL (2 funds)
  152647,  // Mirae Asset Nifty MidSmallcap400 Momentum Quality 100 ETF Fund of Fund
  153273,  // UTI Nifty Midsmallcap 400 Momentum Quality 100 Index Fund - Regular Pl
  // ─── INDEX SENSEX (8 funds)
  101199,  // LIC MF BSE Sensex Index Fund-Regular Plan-Growth
  101281,  // HDFC BSE Sensex Index Fund - Growth Plan
  149802,  // UTI BSE Sensex Index Fund - Regular Plan  -Growth Option
  151765,  // SBI BSE Sensex Index Fund - Regular Plan - Growth
  152061,  // NAVI BSE SENSEX INDEX FUND - REGULAR PLAN - GROWTH
  152421,  // Axis BSE Sensex Index Fund - Regular Plan - Growth
  153284,  // Kotak BSE Sensex Index Fund - Regular - Growth
  154342,  // Invesco India BSE Sensex Index Fund - Regular Plan - Growth
  // ─── INDEX BSE 500 (1 funds)
  151729,  // HDFC BSE 500 Index Fund - Regular Plan - Growth Option
  // ─── INDEX NIFTY ALPHA (9 funds)
  149157,  // ICICI Prudential Nifty Alpha Low - Volatility 30 ETF FOF - Growth
  150490,  // Nippon India Nifty Alpha Low Volatility 30 Index Fund - Regular Plan -
  152179,  // Bandhan Nifty Alpha 50 Index Fund - Regular Plan - Growth
  152617,  // Edelweiss Nifty Alpha Low Volatility 30 Index Fund - Regular Plan - Gr
  152720,  // Mirae Asset Nifty200 Alpha 30 ETF Fund of Fund - Regular Plan - Growth
  152834,  // Tata Nifty200 Alpha 30 Index Fund - Regular -Growth
  153087,  // UTI Nifty Alpha Low-Volatility 30 Index Fund - Regular Plan - Growth O
  153212,  // Bandhan Nifty Alpha Low Volatility 30 Index Fund - Regular Plan - Grow
  153784,  // Kotak Nifty Alpha 50 Index Fund - Regular Plan - Growth
  // ─── INDEX NIFTY MOMENTUM (4 funds)
  150592,  // BANDHAN NIFTY200 MOMENTUM 30 INDEX FUND - GROWTH - REGULAR PLAN
  150657,  // HDFC NIFTY200 MOMENTUM 30 ETF - Growth Option
  152930,  // Baroda BNP Paribas Nifty200 Momentum 30 Index Fund - Regular Plan - Gr
  153663,  // SBI Nifty200 Momentum 30 Index Fund- Regular Plan- Growth
  // ─── INDEX NIFTY QUALITY (2 funds)
  153544,  // ICICI Prudential Nifty200 Quality 30 Index Fund - Growth
  153554,  // SBI Nifty200 Quality 30 Index Fund-Regular Plan- Growth
  // ─── INDEX NIFTY VALUE (1 funds)
  152366,  // ICICI Prudential Nifty50 Value 20 Index Fund - Growth
  // ─── INDEX NIFTY LOW VOL (3 funds)
  150633,  // BANDHAN NIFTY100 LOW VOLATILITY 30 INDEX FUND - GROWTH - REGULAR PLAN
  150658,  // HDFC NIFTY100 Low Volatility 30 ETF - Growth Option
  153716,  // SBI Nifty100 Low Volatility 30 Index Fund- Regular Plan- Growth
  // ─── INDEX NIFTY EQUAL WT (4 funds)
  149106,  // HDFC NIFTY50 Equal weight Index Fund - Growth Option
  150637,  // ICICI Prudential Nifty50 Equal Weight Index Fund- Growth
  151761,  // UTI Nifty50 Equal Weight Index Fund - Regular Plan - Growth Option
  152372,  // SBI Nifty50 Equal Weight Index Fund - Regular Plan - Growth
  // ─── INDEX SECTORAL (25 funds)
  149805,  // Navi Nifty Bank Index Fund- Regular Plan- Growth
  149859,  // ICICI Prudential Nifty Bank Index Fund - Growth
  150466,  // ICICI Prudential Nifty IT Index Fund - Growth
  150645,  // ICICI Prudential Nifty Auto Index Fund - Growth
  150929,  // ICICI Prudential Nifty Pharma Index Fund - Growth
  151787,  // Axis Nifty IT Index Fund - Regular Plan - Growth
  152043,  // Bandhan Nifty IT Index Fund - Regular Plan - Growth
  152387,  // Nippon India Nifty Bank Index Fund - Regular Plan - Growth Option
  152391,  // Nippon India Nifty IT Index Fund - Regular Plan - Growth Option
  152560,  // Tata Nifty Auto Index Fund - Regular Plan - Growth
  152573,  // Tata Nifty Realty Index Fund - Regular Plan - Growth
  152632,  // Axis Nifty Bank Index Fund - Regular Plan - Growth Option
  152653,  // DSP Nifty Bank Index Fund - Regular - Growth
  152711,  // Motilal Oswal Nifty India Defence Index Fund Regular Plan Growth
  152792,  // Bandhan Nifty Bank Index Fund - Regular Plan - Growth
  152800,  // Aditya Birla Sun Life Nifty India Defence Index Fund-Regular-Growth
  152843,  // Bandhan BSE Healthcare Index Fund Regular Plan - Growth
  152927,  // Groww Nifty India Defence ETF FOF - Regular - Growth
  153061,  // Nippon India Nifty Realty Index Fund-Regular Plan- Growth Option
  153066,  // Nippon India Nifty Auto Index Fund - Regular Plan- Growth Option
  153253,  // SBI Nifty Bank Index Fund-Regular Plan- Growth
  153323,  // SBI Nifty IT Index Fund - Regular Plan - Growth
  153588,  // DSP Nifty IT Index Fund - Regular - Growth
  154327,  // Axis Nifty India Defence Index Fund - Regular Plan - Growth
  154344,  // Invesco India Nifty Bank Index Fund - Regular Plan - Growth
  // ─── AGGRESSIVE HYBRID (24 funds)
  100081,  // DSP Aggressive Hybrid Fund- Regular Plan - Growth
  100221,  // JM Aggressive Hybrid Fund (Regular) -Growth Option
  100323,  // LIC MF Aggressive Hybrid Fund-Regular Plan-Growth
  100414,  // Tata Aggressive Hybrid Fund- Regular Plan - Growth Option
  100550,  // Franklin India Aggressive Hybrid Fund - Growth Plan
  100684,  // UTI Aggressive Hybrid Fund - Regular Plan - Growth
  101070,  // quant Aggressive Hybrid Fund - Growth Option - Regular Plan
  112012,  // Edelweiss Aggressive Hybrid Fund- Plan B-Growth Option
  112108,  // Edelweiss Aggressive Hybrid Fund - Regular Plan - Growth Option
  112936,  // Nippon India Aggressive Hybrid Fund - Growth Plan
  125713,  // Shriram Aggressive Hybrid Fund- Regular Growth
  133036,  // Kotak Aggressive Hybrid Fund - Regular Plan -Growth
  134815,  // Mirae Asset Aggressive Hybrid Fund - Regular Plan - Growth
  140381,  // Bandhan Aggressive Hybrid Fund-Regular Plan Growth
  143162,  // Navi Aggressive Hybrid Fund - Regular Plan - Growth
  143536,  // Invesco India Aggressive Hybrid Fund - Regular Plan - Growth
  144393,  // Axis Aggressive Hybrid Fund - Regular Plan - Growth Option
  145605,  // Groww Aggressive Hybrid Fund (formerly known as Indiabulls Equity Hybr
  147447,  // Mahindra Manulife Aggressive Hybrid Fund - Regular Plan - Growth
  148271,  // Nippon India Aggressive Hybrid Fund - Segregated Portfolio 2 - Growth
  148591,  // Union Aggressive Hybrid Fund - Regular Plan - Growth Option
  149599,  // Sundaram Aggressive Hybrid Fund (Formerly Known as Principal Hybrid Eq
  150258,  // Baroda BNP Paribas Aggressive Hybrid Fund- REGULAT PLAN -GROWTH OPTION
  151120,  // HSBC Aggressive Hybrid Fund - Regular Growth
  // ─── BALANCED ADVANTAGE (45 funds)
  100119,  // HDFC Balanced Advantage Fund - Growth Plan
  102846,  // Nippon India Balanced Advantage Fund-Growth Plan-Growth Option
  104406,  // ING Dynamic Asset Allocation Fund- Growth Option
  104685,  // ICICI Prudential Balanced Advantage Fund - Growth
  106317,  // Invesco India Balanced Advantage Fund - Regular Plan - Growth
  106670,  // HSBC Dynamic Asset Allocation Fund - Growth
  112117,  // Edelweiss Balanced Advantage Fund - Regular Plan - Growth Option
  114301,  // Principal Balanced Advantage Fund - Growth Option
  114309,  // DHFL Pramerica Dynamic Asset Allocation Fund - Growth Option
  118194,  // L&T Balanced Advantage Fund-Regular Plan-Growth
  126394,  // DSP Dynamic Asset Allocation Fund - Regular Plan - Growth
  127849,  // BANK OF INDIA BALANCED ADVANTAGE FUND REGULAR PLAN  GROWTH
  131357,  // BANDHAN Balanced Advantage Fund Regular Plan Growth
  131666,  // Aditya Birla Sun Life Balanced Advantage Fund - Regular Plan - Growth
  134109,  // SBI Dynamic Asset Allocation Fund - Regular Plan - Growth
  134152,  // JPMorgan India Balanced Advantage Fund - Regular Plan - Growth Option
  139870,  // Motilal Oswal Balanced Advantage Fund (MOFDYNAMIC) - Regular Plan - Gr
  140359,  // Edelweiss Balanced Advantage Fund - Regular Plan - Growth Option-deact
  141644,  // Axis Balanced Advantage Fund - Regular Plan - Growth
  142035,  // Union Balanced Advantage Fund - Regular Plan - Growth Option
  144333,  // Kotak Balanced Advantage Fund -Regular Plan - Growth Option
  145387,  // Baroda BNP Paribas Balanced Advantage Fund-Regular Plan -Growth Option
  146007,  // Tata Balanced Advantage Fund-Regular Plan-Growth
  147405,  // Shriram Balanced Advantage Fund - Regular Growth
  147787,  // ITI Balanced Advantage Fund - Regular Plan - Growth Option
  148024,  // Sundaram Balanced Advantage Fund Regular Plan - Growth
  148657,  // PGIM India Balanced Advantage Fund - Regular Plan - Growth Option
  149132,  // SBI Balanced Advantage Fund - Regular Plan - Growth
  149259,  // LIC MF Balanced Advantage Fund-Regular Plan-Growth
  149266,  // NJ Balanced Advantage Fund - Regular Plan - Growth Option
  149404,  // Mahindra Manulife Balanced Advantage Fund - Regular Plan - Growth
  149715,  // Sundaram Balanced Advantage Fund (Formerly Known as Principal Balanced
  150473,  // Mirae Asset Balanced Advantage Fund Regular Plan- Growth
  150480,  // Franklin India Balanced Advantage Fund- Growth
  151127,  // HSBC Balanced Advantage Fund - Regular Growth
  151268,  // WhiteOak Capital Balanced Advantage Fund Regular Plan Growth
  151714,  // quant Dynamic Asset Allocation Fund - Growth Option - Regular Plan
  151882,  // UTI Balanced Advantage Fund - Regular Plan - Growth Option
  152187,  // Samco Dynamic Asset Allocation Fund - Regular Plan - Growth Option
  152196,  // Bajaj Finserv Balanced Advantage Fund-Regular Plan-Growth
  152464,  // Parag Parikh Dynamic Asset Allocation Fund - Regular Plan Growth
  152512,  // Helios Balanced Advantage Fund- Regular Plan- Growth Option
  152690,  // Canara Robeco Balanced Advantage Fund - Regular Plan - Growth Option
  153377,  // Unifi Dynamic Asset Allocation Fund - Regular Growth
  154183,  // The Wealth Company Balanced Advantage Fund - Regular Growth
  // ─── CONSERVATIVE HYBRID (27 funds)
  100601,  // CANARA ROBECO CONSERVATIVE HYBRID FUND - REGULAR PLAN - GROWTH OPTION
  100948,  // Franklin India Conservative Hybrid Fund - Growth
  100968,  // SBI Conservative Hybrid Fund - Regular Plan - Growth
  101430,  // HDFC Regular Savings Fund-GROWTH
  101818,  // Aditya Birla Sun Life Regular Savings Fund - Growth / Payment - Regula
  101869,  // LIC MF Conservative Hybrid Fund-Regular Plan-Growth
  102262,  // HSBC Conservative Hybrid Fund - Regular Growth
  102330,  // ICICI Prudential Regular Savings Fund - Plan - Growth
  102448,  // DSP Regular Savings Fund- Regular Plan - Growth
  102535,  // UTI Conservative Hybrid Fund - Regular Plan - Growth Option
  102661,  // BARODA CONSERVATIVE HYBRID FUND - Plan A - Growth Option
  103083,  // Reliance Regular Savings Fund-DEBT OPTION -Growth Option
  103087,  // Reliance Regular Savings Fund-BALANCED OPTION-Growth Option
  111712,  // BANK OF INDIA Conservative Hybrid Fund-Regular Plan-Growth
  111715,  // BANK OF INDIA Conservative Hybrid Fund-ECO Plan-Growth
  112079,  // Reliance Regular Savings Fund-DEBT OPTION- Institutional Plan-Growth O
  112353,  // BANDHAN Conservative Hybrid Fund - Regular Plan - Growth
  112487,  // L&T Conservative Hybrid Fund- Regular Plan - Growth
  112868,  // Sundaram Conservative Hybrid Fund (Formerly Known as Sundaram Debt Ori
  112874,  // Sundaram Regular Savings Fund - GROWTH
  112887,  // Invesco India Regular Savings Fund - Growth
  112924,  // Axis Conservative Hybrid Fund - Regular Plan - Growth Option
  113142,  // Navi Conservative Hybrid Fund-Growth
  113560,  // BNP PARIBAS Conservative Hybrid Fund-Regular Plan-Growth Option
  148959,  // Parag Parikh Conservative Hybrid Fund - Regular Plan - Growth
  149898,  // ITI Conservative Hybrid Fund - Regular Plan -Growth
  150203,  // BARODA BNP PARIBAS Conservative Hybrid Fund-Regular Plan-Growth Option
  // ─── MULTI ASSET (32 funds)
  101072,  // quant Multi Asset Allocation Fund-GROWTH OPTION - Regular Plan
  103408,  // SBI MULTI ASSET ALLOCATION FUND - REGULAR PLAN - GROWTH
  111599,  // UTI Multi Asset Allocation Fund - Regular Plan - Growth Option
  113064,  // Axis Multi Asset Allocation Fund - Regular Plan - Growth Option
  114382,  // Kotak Multi Asset Allocation Fund-Growth
  148050,  // Tata Multi Asset Allocation Fund-Regular Plan-Growth
  148459,  // Nippon India Multi Asset Allocation Fund - Regular Plan - Growth Optio
  151309,  // Aditya Birla Sun Life Multi Asset Allocation Fund-Regular Growth
  151746,  // WhiteOak Capital Multi Asset Allocation Fund Regular Plan Growth
  151795,  // Edelweiss Multi Asset Allocation Fund - Regular Plan - Growth
  152052,  // Shriram Multi Asset Allocation Fund - Regular Growth
  152053,  // DSP Multi Asset Allocation Fund - Regular - Growth
  152065,  // Kotak Multi Asset Allocation Fund - Regular Plan - Growth Option
  152311,  // Sundaram Multi Asset Allocation Fund Regular Plan Growth
  152326,  // Bandhan Multi Asset Allocation Fund - Regular Plan - Growth
  152347,  // Mirae Asset Multi Asset Allocation Fund - Regular Plan - Growth
  152378,  // HSBC Multi Asset Allocation Fund - Regular - Growth
  152398,  // Bank of India Multi Asset Allocation Fund-Regular Plan-Growth
  152441,  // Mahindra Manulife Multi Asset Allocation Fund- Regular Plan - Growth
  152475,  // Quantum Multi Asset Allocation Fund - Regular Plan Growth Option
  152642,  // Bajaj Finserv Multi Asset Allocation Fund - Regular Growth
  152786,  // Union Multi Asset Allocation Fund- Regular Plan - Growth Option
  153046,  // Invesco India Multi Asset Allocation Fund - Regular Plan - Growth
  153093,  // Samco Multi Asset Allocation Fund - Regular Plan - Growth
  153248,  // LIC MF Multi Asset Allocation Fund-Regular Plan-Growth
  153466,  // Canara Robeco Multi Asset Allocation Fund - Regular Plan - Growth
  153733,  // Franklin India Multi Asset Allocation Fund- Growth
  153772,  // 360 ONE Multi Asset Allocation Fund - Regular Plan - Growth
  153851,  // Groww Multi Asset Allocation Fund Regular Growth
  153988,  // PGIM India Multi Asset Allocation Fund - Regular Plan - Growth Option
  154002,  // The Wealth Company Multi Asset Allocation Fund - Regular Growth
  154231,  // Capitalmind Multi Asset Allocation Fund-Regular-Growth
  // ─── EQUITY SAVINGS (32 funds)
  100151,  // Principal Retail Equity Savings Fund - Growth Option
  101498,  // Principal Equity Savings Fund - Growth Option
  101585,  // HDFC Equity Savings Fund - GROWTH PLAN
  101906,  // Tata Equity Savings Fund -Regular Plan-Growth Option
  108994,  // IDFC Equity Savings Fund -B-GROWTH
  108995,  // BANDHAN Equity Savings Fund - Regular Plan - Growth
  114982,  // IDBI Equity Savings Fund Growth Option
  115887,  // L&T Equity Savings Fund - Regular Plan - Growth
  131372,  // Kotak Equity Savings Fund - Regular - Growth
  132998,  // Aditya Birla Sun Life Equity Savings Fund - Regular Plan - Growth
  134593,  // Nippon India Equity Savings Fund- Growth Plan- Growth Option
  134644,  // SBI Equity Savings Fund - Regular Plan - Growth
  135122,  // Axis Equity Savings Fund - Regular Plan - Growth
  136563,  // DSP Equity Savings Fund - Regular Plan - Growth
  138372,  // PGIM India Equity Savings Fund - Growth Option
  140351,  // Edelweiss Equity Savings Fund - Regular Plan - Growth Option
  140447,  // Mahindra Manulife Equity Savings Fund - Regular Plan - Growth
  144310,  // Union Equity Savings Fund - Regular Plan - Growth Option
  144461,  // Franklin India Equity Savings Fund- Growth
  144484,  // UTI Equity Savings Fund - Regular Plan - Growth Option
  145475,  // Sundaram Equity Savings Fund Regular Plan - Growth
  145695,  // Mirae Asset Equity Savings Fund- Regular Plan- Growth
  146456,  // Invesco India Equity Savings Fund - Regular Plan - Growth
  147494,  // Baroda BNP Paribas Equity Savings Fund - Regular Plan - Growth
  147700,  // Nippon India Equity Savings Fund - Segregated Portfolio 1 - Growth Pla
  148280,  // Nippon India Equity Savings Fund - Segregated Portfolio 2 - Growth Pla
  149674,  // Sundaram Equity Savings Fund (Formerly Known as Principal Equity Savin
  151058,  // HSBC Equity Savings Fund - Regular Growth
  151950,  // LIC MF Equity Savings Fund-Regular Plan-Growth
  153356,  // WhiteOak Capital Equity Savings Fund Regular Plan Growth
  153707,  // quant Equity Savings Fund - Growth Option - Regular Plan
  153769,  // BAJAJ FINSERV EQUITY SAVINGS FUND - REGULAR - GROWTH
  // ─── ARBITRAGE (52 funds)
  103224,  // Kotak Cash Plus---Growth (Upto 17/06/07) renamed as Kotak Equity Arbit
  103780,  // JM Arbitrage Fund (Regular) - Growth Option
  104075,  // UTI Arbitrage Fund - Regular Plan - Growth Option
  104601,  // Standard Chartered Arbitrage Fund-Plan A - Growth
  104603,  // Standard Chartered Arbitrage Fund-Plan B - Growth
  104683,  // ICICI Prudential Equity Arbitrage Fund - Growth
  104684,  // ICICI Prudential Equity - Arbitrage Fund-Institutional Growth Option
  105603,  // Invesco India Arbitrage Fund - Regular Plan - Growth Option
  105968,  // Kotak Arbitrage Fund - Regular Plan - Growth
  106793,  // HDFC ARBITRAGE FUND - Regular Plan -Growth Option
  106796,  // HDFC ARBITRAGE FUND - Retail Growth Option
  108845,  // BANDHAN Arbitrage Fund - Regular Plan - Growth
  108846,  // IDFC Arbitrage Fund - Plan B - Growth
  108899,  // IDFC Fixed Maturity Arbitrage Fund - Series 1 - Plan B - Growth
  108900,  // IDFC Fixed Maturity Arbitrage Fund - Series 1 - Plan A - Growth
  112086,  // Aditya BIRLA SUN LIFE ARBITRAGE FUND - INSTITUTIONAL PLAN - GROWTH
  112088,  // Aditya BIRLA SUN LIFE ARBITRAGE FUND - REGULAR PLAN - GROWTH
  113345,  // Nippon India Arbitrage Fund - Growth Plan - Growth Option
  130205,  // Edelweiss Arbitrage Fund- Regular Plan- Growth Option
  130771,  // Axis Arbitrage Fund - Regular Plan - Growth
  131022,  // DWS Arbitrage Fund - Regular Plan - Growth
  133184,  // Groww Arbitrage Fund (formerly known as Indiabulls Arbitrage Fund) - R
  138876,  // PGIM India Arbitrage Fund - Regular Plan - Growth
  139224,  // Principal Arbitrage Fund - Regular Plan - Growth
  140385,  // BNP PARIBAS ARBITRAGE FUND- REGULAR PLAN- GROWTH OPTION
  142282,  // DSP Arbitrage Fund - Regular - Growth
  143620,  // BANK OF INDIA Arbitrage Fund Regular Growth
  144784,  // Navi Arbitrage Fund - Regular Plan - Growth
  145723,  // Tata Arbitrage Fund-Regular Plan-Growth
  145890,  // LIC MF Arbitrage Fund-Regular Plan-Growth
  146294,  // Union Arbitrage Fund - Regular Plan - Growth Option
  147618,  // ITI Arbitrage Fund - Regular Plan - Growth Option
  147922,  // Sundaram Arbitrage Fund Regular Plan - Growth
  148400,  // Mirae Asset Arbitrage Fund Regular Growth
  148467,  // Mahindra Manulife Arbitrage Fund - Regular Plan - Growth
  149552,  // Sundaram Arbitrage Fund (Formerly Know as Principal Arbitrage Fund) -
  150250,  // BARODA BNP PARIBAS ARBITRAGE FUND- REGULAR PLAN- GROWTH OPTION
  150366,  // NJ Arbitrage Fund - Regular Plan - Growth Option
  151134,  // HSBC Arbitrage Fund - Regular Growth
  152078,  // Bajaj Finserv Arbitrage Fund- Regular Plan-Growth
  152110,  // Parag Parikh Arbitrage Fund - Regular Plan Growth
  152850,  // WhiteOak Capital Arbitrage Fund Regular Plan Growth
  153042,  // Franklin India Arbitrage Fund - Growth
  153091,  // Samco Arbitrage Fund - Regular Plan - Growth
  153188,  // Motilal Oswal Arbitrage Fund-Regular Plan-Growth
  153428,  // quant Arbitrage Fund - Growth Option - Regular Plan
  153805,  // TRUSTMF ARBITRAGE FUND -REGULAR PLAN-GROWTH
  153892,  // THE WEALTH COMPANY ARBITRAGE FUND REGULAR GROWTH
  153977,  // Old Bridge Arbitrage Fund Regular Growth
  154233,  // Capitalmind Arbitrage Fund-regular-Growth
  154258,  // Helios Arbitrage Fund - Regular Growth
  154325,  // Groww Arbitrage Fund Regular Growth
  // ─── OVERNIGHT (46 funds)
  101206,  // SBI OVERNIGHT FUND - REGULAR PLAN - GROWTH
  101996,  // HDFC Overnight Fund - Growth Option
  106501,  // Religare Invesco Overnight Fund - Growth
  108960,  // ABN AMRO Overnight Fund-Institutional Plus Plan-Growth Option
  108961,  // ABN AMRO Overnight Fund-Institutional Plan-Growth Option
  108962,  // ABN AMRO Overnight Fund-Regular Plan-Growth Option
  110915,  // Fortis Overnight Fund-Institutional Plan-Growth Option
  110920,  // Fortis Overnight Fund-Institutional Plus Plan-Growth Option
  110921,  // Fortis Overnight Fund-Regular Plan-Growth Option
  118058,  // L&T Overnight Fund - Regular Plan - Growth
  145481,  // ADITYA BIRLA SUNLIFE OVERNIGHT FUND-REGULAR PLAN-GROWTH
  145535,  // ICICI Prudential Overnight Fund - Growth
  145811,  // Nippon India Overnight Fund - Regular Plan - Growth Option
  146061,  // DSP Overnight Fund - Regular Plan - Growth
  146142,  // Kotak Overnight Fund -Regular plan-Growth Option
  146187,  // BANDHAN Overnight Fund - Regular Plan - Growth
  146678,  // Axis Overnight Fund - Regular Plan - Growth Option
  146959,  // Sundaram Overnight Fund Regular Plan - Growth
  146977,  // Tata Overnight Fund-Regular Plan-Growth
  146997,  // Union Overnight Fund - Regular Plan - Growth Option
  147124,  // BNP Paribas Overnight Fund - Regular Plan-Growth Option
  147193,  // Baroda BNP Paribas Overnight Fund - Regular Plan - Growth
  147213,  // Franklin India Overnight fund- Growth
  147290,  // HSBC Overnight Fund - Regular Growth
  147454,  // Groww Overnight Fund (formerly known as Indiabulls Overnight Fund)- Re
  147519,  // LIC MF Overnight Fund-Regular Plan-Growth
  147534,  // CANARA ROBECO OVERNIGHT FUND - REGULAR PLAN - GROWTH OPTION
  147565,  // Mahindra Manulife Overnight Fund - Regular Plan - Growth
  147569,  // Edelweiss Overnight Fund - Regular Plan - Growth
  147590,  // WhiteOak Capital Overnight Fund- Regular plan-Growth Option
  147600,  // PGIM India Overnight Fund - Regular Plan- Growth Option
  147714,  // ITI Overnight Fund - Regular Plan - Growth Option
  147739,  // Mirae Asset Overnight Fund Regular Plan Growth
  147836,  // JM Overnight Fund (Regular) - Growth
  147878,  // Invesco India Overnight Fund - Regular Plan - Growth
  147936,  // BANK OF INDIA Overnight Fund Regular Plan Growth
  149795,  // TRUST MF OVERNIGHT FUND-REGULAR-GROWTH
  150368,  // NJ Overnight Fund - Regular Plan - Growth Option
  150565,  // Shriram Overnight Fund - Regular Growth
  150632,  // Samco Overnight Fund - Regular Plan - Growth Option
  151195,  // quant Overnight Fund - Growth Option - Regular Plan
  151851,  // Bajaj Finserv Overnight Fund - Regular Plan - Growth
  151868,  // NAVI Overnight Fund Regular Plan Growth
  152153,  // Helios Overnight Fund - Regular Plan - Growth Option
  153700,  // 360 ONE Overnight Fund - Regular Plan - Growth
  154070,  // JioBlackRock Overnight Fund - Unclaimed Redemption - Upto 3 years - Gr
  // ─── LIQUID (111 funds)
  100042,  // Aditya Birla Sun Life Liquid Fund-Retail (Growth)
  100043,  // Aditya Birla Sun Life Liquid Fund-Institutional (Growth)
  100047,  // Aditya Birla Sun Life Liquid Fund - Growth
  100190,  // ING Liquid Fund-Regular Growth Option
  100194,  // ING Liquid Fund-Auto Sweep Growth Option
  100196,  // ING Liquid Fund-Institutional Growth Option
  100199,  // ING Liquid Fund-Super Institutional Growth Option
  100234,  // JM Liquid Fund - Growth Option
  100247,  // JM Liquid Fund (Regular) - Super Institutional Plan - Growth Option
  100501,  // Templeton India Liquid Fund-Growth
  100538,  // Franklin India Liquid Fund - Regular Plan - Growth
  100544,  // Franklin India Liquid Fund - Liquid Plan - Growth
  100546,  // Franklin India Liquid Fund - Super Institutional Plan - Growth
  100835,  // Kotak Liquid Fund - Regular Plan - Growth
  100837,  // Nippon India Liquid Fund - Retail Option - Growth Plan
  100845,  // Reliance Liquid Fund-Cash Plan-Growth Plan
  100851,  // Nippon India Liquid Fund -Growth Plan
  100868,  // HDFC Liquid Fund - Growth Plan
  100872,  // HDFC Liquid Fund-PREMIUM PLUS- Growth
  100873,  // HDFC Liquid Fund-PREMIUM- Growth
  101185,  // LIC MF Liquid Fund-Regular Plan-Growth
  101362,  // Canara Robeco Liquid Fund- INSTITUTIONAL-Growth
  101365,  // Canara Robeco Liquid Fund-Retail-Growth
  101394,  // Sahara Liquid Fund-Fixed Pricing - Growth option
  101402,  // Sahara Liquid Fund-Variable Pricing - Growth option
  101408,  // Baroda BNP Paribas LIQUID FUND- Defunct Plan -Growth Option
  101750,  // ICICI Prudential Liquid Fund Retail Growth
  101929,  // SBI Magnum Institutional Income Fund - Savings - Growth(Upto 22/03/07)
  102004,  // UTI-  Liquid Fund-Short Term Plan-Growth
  102441,  // Franklin India Liquid Fund - Institution-Growth
  102672,  // Tata Liquid Fund -Regular Plan - Growth Option
  103225,  // quant Liquid Fund - Growth Option - Regular Plan
  103340,  // ICICI Prudential Liquid Fund - Growth
  104241,  // Taurus Liquid Fund-Growth
  104486,  // Invesco India Liquid Fund - Growth
  104488,  // Invesco India Liquid Fund - Regular - Growth
  104491,  // Religare Invesco Liquid Fund - Institutional - Growth
  105274,  // SBI Liquid Fund - Institutional - Growth
  105280,  // SBI Liquid Fund - REGULAR PLAN -Growth
  106508,  // PineBridge India Liquid Fund- Standard Plan-Growth Option
  106511,  // PineBridge India Liquid Fund-Institutional Plan-Growth Option
  106514,  // PineBridge India Liquid Fund-Retail Plan-Growth Option
  106561,  // JPMorgan India Liquid Fund - Retail Plan - Growth Option
  107648,  // Mirae Asset Liquid Fund- Regular Plan - Growth
  107659,  // Mirae Asset Liquid Fund- Institutional Plan - Growth
  107672,  // Mirae Asset Liquid Fund- Super Institutional Plan - Growth
  108690,  // BANDHAN LIQUID Fund - Regular Plan - Growth
  108793,  // IDFC Liquid Fund - Growth
  109254,  // BANK OF INDIA Liquid Fund- Regular Plan- Growth
  109256,  // BOI AXA Liquid Fund- Institutional Plan-Growth
  109258,  // BOI AXA Liquid Fund- Super Institutional Plan-Growth
  109353,  // CANARA ROBECO LIQUID FUND - REGULAR PLAN - GROWTH OPTION
  109940,  // Edelweiss Liquid Fund - Retail Plan - Growth Option
  109945,  // Edelweiss Liquid Fund - Institutional Plan - Growth Option
  109946,  // Edelweiss Liquid Fund - Growth Option
  110150,  // JPMorgan India Liquid Fund - Super Institutional Plan - Growth Option
  111646,  // Mirae Asset Liquid Fund - Regular Plan - Growth
  111704,  // Baroda BNP Paribas LIQUID FUND - Regular Plan - GROWTH OPTION
  111760,  // Taurus Liquid Fund Insti Growth
  111915,  // Taurus Liquid Fund - Regular Plan - SI Growth Option
  111928,  // IDFC Liquid Fund  Plan D- Growth
  112040,  // Shinsei Liquid Fund - Retail - Growth
  112041,  // Shinsei Liquid Fund - Institutional - Growth
  112210,  // Axis Liquid Fund - Regular Plan - Growth Option
  112457,  // L&T Liquid Fund -Regular Plan - Growth
  112636,  // Navi Liquid Fund-Regular Plan-Growth Option
  112640,  // Essel Liquid Fund-Institutional Plan-Growth
  112644,  // Essel Liquid Fund-Retail Plan-Growth
  112713,  // Axis Liquid Fund - Retail Plan - Growth Option
  112890,  // IDFC Liquid Fund- Plan F Growth
  113096,  // IDBI Liquid Fund-Growth
  113183,  // DHFL Pramerica Liquid Fund - Growth Option
  113634,  // BNP PARIBAS LIQUID Fund-Institutional Plan-Growth Option
  113639,  // BNP PARIBAS LIQUID Fund-Institutional Plus Plan-Growth Option
  113640,  // BNP PARIBAS LIQUID Fund-Regular Plan-Growth Option
  114514,  // Daiwa Liquid Fund - Regular - Growth
  114515,  // Daiwa Liquid Fund - Institutional - Growth
  115398,  // Union Liquid Fund - Growth Option
  115812,  // MS Liquid Fund - Regular- Growth
  115991,  // Groww Liquid Fund (formerly known as Indiabulls Liquid Fund) - Regular
  117941,  // BNP PARIBAS LIQUID FUND  GROWTH OPTION
  118902,  // HSBC Liquid Fund - Regular Growth
  118907,  // HSBC Liquid Fund - Growth
  125259,  // 360 ONE LIQUID FUND REGULAR PLAN  GROWTH
  130459,  // BNP PARIBAS LIQUID FUND - REGULAR PLAN - GROWTH OPTION
  130472,  // BNP PARIBAS LIQUID FUND - GROWTH OPTION
  138288,  // PGIM India Liquid Fund - Growth
  139537,  // Mahindra Manulife Liquid Fund - Regular Plan - Growth
  139560,  // BNP PARIBAS LIQUID FUND SPECIAL UNCLAIMED RED 36A-- GROWTH OPTION
  139561,  // BNP PARIBAS LIQUID FUND SPECIAL UNCLAIMED DIV 36B -- GROWTH OPTION
  139562,  // BNP PARIBAS LIQUID FUND SPECIAL UNCLAIMED DIV 36A -- GROWTH OPTION
  139563,  // BNP PARIBAS LIQUID FUND SPECIAL UNCLAIMED RED 36B -- GROWTH OPTION
  139889,  // Franklin India Liquid Fund - Unclaimed Redemption Plan - Growth
  139891,  // Franklin India Liquid Fund - Unclaimed Redemption Investor Education P
  140176,  // Edelweiss Liquid Fund - Retail Plan - Growth Option
  140182,  // Edelweiss Liquid Fund - Regular Plan - Growth Option
  141066,  // Quantum Liquid Fund - Regular Plan Growth Option
  143260,  // Parag Parikh Liquid Fund- Regular Plan- Growth
  145946,  // Motilal Oswal Liquid Fund - Regular Growth
  145968,  // WhiteOak Capital Liquid Fund- Regular plan-Growth Option
  147153,  // ITI Liquid Fund - Regular Plan - Growth Option
  148511,  // quant Liquid Fund-Unclaimed Redemption Investor Education Plan-Growth
  148512,  // quant Liquid Fund-Unclaimed Redemption Plan-Growth Option
  148833,  // TRUSTMF Liquid Fund-Regular Plan-Growth
  149661,  // Sundaram Liquid Fund (Formerly Known as Principal Cash Management Fund
  151837,  // Bajaj Finserv Liquid Fund - Regular Plan - Growth
  153036,  // Shriram Liquid Fund - Regular Plan Growth Option
  153571,  // Unifi Liquid Fund- Regular Growth
  153888,  // THE WEALTH COMPANY LIQUID FUND REGULAR GROWTH
  154010,  // Capitalmind Liquid Fund - Regular-Growth
  154047,  // Abakkus Liquid Fund - Regular Plan - Growth
  // ─── ULTRA SHORT DURATION (41 funds)
  100641,  // SBI ULTRA SHORT DURATION FUND - REGULAR PLAN - GROWTH
  102532,  // UTI Ultra Short Duration Fund - Regular Plan - Growth Option
  104271,  // JM Ultra Short Duration Fund - Growth option
  106217,  // SBI Short Horizon Debt Fund - Ultra Short Term Fund - Institutional Pl
  106329,  // Canara Robeco Ultra Short Term Fund - Retail Plan- Growth Option
  106330,  // Canara Robeco Ultra Short Term Fund - Institutional Plan- Growth optio
  107328,  // Principal Ultra Short Term Fund-Growth Option
  107820,  // DWS Ultra Short Term Fund - Regular Plan - Growth
  109265,  // BOI AXA Ultra Short Duration Fund- Institutional Plan- Growth
  109269,  // BANK OF INDIA Ultra Short Duration Fund- Regular Plan- Growth
  109302,  // DWS Ultra Short Term Fund - Growth
  109371,  // CANARA ROBECO ULTRA SHORT TERM FUND - REGULAR PLAN - GROWTH OPTION
  112083,  // UTI Ultra Short Duration Fund - Discontinued - INSTN GROWTH OPTION
  112408,  // Navi Ultra Short Term Fund - Regular Plan-Growth Option
  112423,  // L&T Ultra Short Term Fund - Regular Plan - Growth
  112654,  // Essel Ultra Short Term Fund - Institutional Plan-Growth
  112656,  // Essel Ultra Short Term Fund - Retail Plan-Growth
  114359,  // Invesco India Ultra Short Duration Fund - Regular Plan - Growth
  115092,  // ICICI Prudential Ultra Short Term Fund - Growth
  116376,  // DWS Ultra Short Term Fund - Premium Plus Plan - Growth
  116424,  // Indiabulls Ultra Short Term Fund - Growth Option
  123120,  // Morgan Stanley Ultra Short Term Fund - Regular Growth
  124233,  // Motilal Oswal Ultra Short Term Fund (MOFUSTF)-Regular Plan- Growth
  138337,  // PGIM India Ultra Short Term Fund - Regular Plan - Growth
  138343,  // PGIM India Ultra Short Duration Fund - Growth
  143464,  // Baroda BNP Paribas Ultra Short Duration Fund - Regular Plan - Growth
  143493,  // Nippon India Ultra Short Duration Fund- Growth Option
  144171,  // BANDHAN ULTRA SHORT DURATION FUND - REGULAR PLAN GROWTH
  144759,  // Axis Ultra Short Duration Fund - Regular Plan Growth
  145040,  // HDFC Ultra Short Term Fund - Growth Option
  146070,  // Tata Ultra Short Term Fund-Regular Plan-Growth
  147307,  // WhiteOak Capital Ultra Short Duration Fund- Regular plan-Growth Option
  147425,  // Sundaram Ultra Short Term Fund Regular Plan - Growth
  147674,  // Nippon India Ultra Short Duration Fund - Segregated Portfolio 1 - Grow
  147734,  // Mahindra Manulife Ultra Short Duration Fund - Regular Plan - Growth
  147770,  // LIC MF Ultra Short Duration Fund-Regular Plan-Growth
  147907,  // HSBC Ultra Short Duration Fund - Regular Growth
  148530,  // Mirae Asset Ultra Short Duration Fund Regular Growth
  148906,  // ITI Ultra Short Duration Fund - Regular Plan - Growth Option
  149535,  // Sundaram Ultra Short Duration Fund (Formerly Known as Principal Ultra
  152828,  // Franklin India Ultra Short Duration Fund - Growth
  // ─── LOW DURATION (45 funds)
  101830,  // LIC MF Low Duration Fund-Regular Plan-Growth
  102540,  // UTI Low Duration Fund - Discontinued Growth Option
  102544,  // UTI Low Duration Fund - Regular Plan - Growth Option
  102719,  // Principal Low Duration Fund - Growth
  102722,  // Principal Low Duration Fund- Growth Option
  103192,  // Aditya Birla Sun Life Low Duration Fund - Growth Plan
  103195,  // Aditya Birla Sun Life Low Duration Fund - Institutional Plan - Growth
  103591,  // DWS Low Duration Fund - Regular Plan - Growth
  104344,  // HSBC Low Duration Fund  - Growth
  104350,  // HSBC Low Duration Fund  - Regular - Growth
  104425,  // DWS Low Duration Fund - Growth
  104726,  // Invesco India Low Duration Fund - Growth
  104728,  // Invesco India Low Duration Fund - Regular - Growth
  105544,  // HDFC Low Duration Fund- Wholesale- Growth
  105562,  // Sundaram Low Duration Fund Institutional Plan - Growth
  105563,  // Sundaram Low Duration Fund Regular Plan - Growth
  105564,  // Sundaram Low Duration Fund Retail Plan - Growth
  106212,  // SBI LOW DURATION FUND - REGULAR PLAN - GROWTH
  107705,  // Mirae Asset Low Duration Fund - Regular Plan - Growth
  108632,  // BANDHAN Low Duration Fund - Regular Plan - Growth
  111748,  // Nippon India Low Duration Fund - Retail Plan - Growth Plan - Growth Op
  111753,  // Nippon India Low Duration Fund- Growth Plan - Growth Option
  113135,  // Franklin India Low Duration Fund - Growth Plan
  113476,  // BNP PARIBAS LOW DURATION Fund-Regular Plan-Growth Option
  113479,  // BNP PARIBAS LOW DURATION Fund-Institutional Plan-Growth Option
  117945,  // BNP PARIBAS LOW DURATION FUND GROWTH OPTION
  118133,  // L&T Low Duration Fund-Regular Plan - Growth
  133802,  // Kotak Low Duration Fund-Retail Plan-Growth Option
  133805,  // Kotak Low Duration Fund- Regular Plan-Growth Option
  133926,  // DSP Low Duration Fund - Regular Plan - Growth
  140201,  // Edelweiss Low Duration Fund - Retail Plan - Growth Option
  140207,  // Edelweiss Low Duration Fund - Regular Plan - Growth Option
  140620,  // Mahindra Manulife Low Duration Fund - Regular Plan - Growth
  143607,  // JM Low Duration Fund (Regular) - Growth Option
  147994,  // Franklin India Low Duration Fund- Segregated Portfolio 1- 8.25% Vodafo
  148000,  // Franklin India Low Duration Fund- Segregated Portfolio 2- 10.90% Vodaf
  149519,  // Sundaram Low Duration Fund (Formerly Known as Principal Low Duration F
  149810,  // PGIM India Low Duration Fund - Segregated Portfolio 1 - Regular Plan -
  150160,  // BARODA BNP PARIBAS LOW DURATION Fund-Defunct Plan-Growth Option
  150165,  // BARODA BNP PARIBAS LOW DURATION FUND - Regular Plan - GROWTH OPTION
  151114,  // HSBC Low Duration Fund - Regular Growth
  153371,  // Franklin India Low Duration Fund-Growth
  153419,  // Edelweiss Low Duration Fund - Regular Plan Growth
  153652,  // Union Low Duration Fund - Regular Plan - Growth Option
  154203,  // Bajaj Finserv Low Duration Fund - Regular - Growth
  // ─── MONEY MARKET (30 funds)
  101221,  // ICICI Prudential Money Market Fund Retail Growth (erstwhile Cash Optio
  101357,  // Franklin India Money Market Fund - Growth Option
  101847,  // Tata Money Market Fund-Regular Plan - Growth Option
  101893,  // Kotak Money Market Fund - (Growth)
  101993,  // HDFC Money Market Fund - Growth Option
  102153,  // Tata Money Market Fund Regular (Growth)
  103048,  // Nippon India Money Market Fund-Growth Plan-Growth Option
  103464,  // Quant Money Market Fund-Growth Option
  103633,  // ICICI Prudential Money Market Fund Option - Growth
  108756,  // BANDHAN Money Market Fund - Regular Plan - Growth
  112120,  // Invesco India Money Market Fund - Regular - Growth
  112123,  // Invesco India Money Market Fund - Growth
  114216,  // L&T Money Market Fund - Regular Plan - Growth
  140229,  // Edelweiss Money Market Fund - Regular Plan - Growth Option
  140230,  // Edelweiss Money Market Fund - Institutional Plan - Growth Option
  143598,  // JM Money Market Fund - Growth
  145042,  // Sundaram Money Market Fund Regular Plan - Growth
  147382,  // Baroda BNP Paribas Money Market Fund-Regular Plan - Growth
  147568,  // Axis Money Market Fund - Regular Plan - Growth Option
  148159,  // PGIM India Money Market Fund - Regular Plan - Growth Option
  149115,  // Mirae Asset Money Market Fund Regular Growth
  149116,  // Union Money Market Fund - Regular Plan -  Growth Option
  150393,  // LIC MF Money Market Fund-Regular Plan-Growth
  150511,  // TRUSTMF MONEY MARKET FUND-REGULAR PLAN-GROWTH
  151048,  // HSBC Money Market Fund - Regular Growth
  151893,  // Bajaj Finserv Money Market Fund-Regular Plan-Growth
  152122,  // PGIM India Money Market Fund - Segregated Portfolio 1 - Regular plan -
  153293,  // Bank of India Money Market Fund - Regular - Growth
  153992,  // Groww Money Market Fund Regular Growth
  154143,  // Shriram Money Market Fund - Regular Plan Growth Option
  // ─── SHORT DURATION (83 funds)
  100641,  // SBI ULTRA SHORT DURATION FUND - REGULAR PLAN - GROWTH
  101231,  // ICICI Prudential Short Term Fund-Institutional Growth
  101304,  // DSP Short Term Fund - Regular Plan - Growth
  101421,  // JM Floater Short Term Fund - Growth Option
  101520,  // JM Short Term Fund - Regular Plan - Growth Option
  101521,  // JM Short Term Fund - Growth Option
  101599,  // HSBC Short Duration Fund - Growth
  101758,  // ICICI Prudential Short Term Fund - Growth Option
  101844,  // Aditya Birla Sun Life Short Term Fund - Growth - Regular Plan
  102532,  // UTI Ultra Short Duration Fund - Regular Plan - Growth Option
  104271,  // JM Ultra Short Duration Fund - Growth option
  105185,  // Invesco India Short Duration Fund - Regular Plan - Growth
  105189,  // Invesco India Short Duration Fund - Plan B - Growth
  106217,  // SBI Short Horizon Debt Fund - Ultra Short Term Fund - Institutional Pl
  106227,  // SBI SHORT HORIZON DEBT FUND-SHORT TERM FUND - RETAIL - GROWTH
  106329,  // Canara Robeco Ultra Short Term Fund - Retail Plan- Growth Option
  106330,  // Canara Robeco Ultra Short Term Fund - Institutional Plan- Growth optio
  106384,  // UTI Short Duration Fund - Discontinued Regular Option -Growth Sub Opti
  106624,  // UTI Short Duration Fund - Regular Plan - Growth Option
  107328,  // Principal Ultra Short Term Fund-Growth Option
  107715,  // PineBridge India Short Term Fund-Retail Plan-Growth Option
  107718,  // PineBridge India Short Term Fund- Standard Plan-Growth Option
  107785,  // ING OptiMix Active Short Term Fund- Retail Plan - Growth Option
  107820,  // DWS Ultra Short Term Fund - Regular Plan - Growth
  108222,  // ING OptiMix Active Short Term Fund-Inst. Plan-Growth Option
  108768,  // Bandhan Short Duration Fund - Regular Plan - Growth
  109265,  // BOI AXA Ultra Short Duration Fund- Institutional Plan- Growth
  109269,  // BANK OF INDIA Ultra Short Duration Fund- Regular Plan- Growth
  109302,  // DWS Ultra Short Term Fund - Growth
  109371,  // CANARA ROBECO ULTRA SHORT TERM FUND - REGULAR PLAN - GROWTH OPTION
  111879,  // Canara Robeco Short Term Fund- Institutional Plan - Growth
  111883,  // Canara Robeco Short Term Fund- Regular Plan - Growth
  112083,  // UTI Ultra Short Duration Fund - Discontinued - INSTN GROWTH OPTION
  112354,  // Axis Short Duration Fund - Regular Plan - Growth Option
  112408,  // Navi Ultra Short Term Fund - Regular Plan-Growth Option
  112423,  // L&T Ultra Short Term Fund - Regular Plan - Growth
  112654,  // Essel Ultra Short Term Fund - Institutional Plan-Growth
  112656,  // Essel Ultra Short Term Fund - Retail Plan-Growth
  112721,  // Axis Short Duration Fund - Retail Plan - Growth Option
  113036,  // Baroda BNP Paribas Short Duration Fund - Regular Plan - Growth Option
  113059,  // 1.	Benchmark Short Term Fund - Growth Option
  113172,  // Essel Short Term Fund-Growth
  113547,  // BNP PARIBAS Short Term Fund-Regular Plan-Growth Option
  113553,  // BNP PARIBAS Short Term Fund-Institutional Plus Plan-Growth Option
  114359,  // Invesco India Ultra Short Duration Fund - Regular Plan - Growth
  115077,  // CANARA ROBECO SHORT DURATION FUND - REGULAR PLAN - GROWTH OPTION
  115092,  // ICICI Prudential Ultra Short Term Fund - Growth
  115752,  // Goldman Sachs Short Term Fund - Growth Option
  116376,  // DWS Ultra Short Term Fund - Premium Plus Plan - Growth
  116424,  // Indiabulls Ultra Short Term Fund - Growth Option
  117281,  // Union Short Term Fund - Growth Option
  117953,  // BNP PARIBAS SHORT TERM FUND GROWTH OPTION
  123120,  // Morgan Stanley Ultra Short Term Fund - Regular Growth
  123708,  // Groww Short Term Fund (formerly known as Indiabulls Short Term Fund )-
  124233,  // Motilal Oswal Ultra Short Term Fund (MOFUSTF)-Regular Plan- Growth
  138256,  // PGIM India Short Duration Fund - Growth
  138337,  // PGIM India Ultra Short Term Fund - Regular Plan - Growth
  138343,  // PGIM India Ultra Short Duration Fund - Growth
  140244,  // Edelweiss Short Term Fund - Regular Plan - Growth Option
  142642,  // Mirae Asset Short Duration Fund - Regular Plan - Growth
  143464,  // Baroda BNP Paribas Ultra Short Duration Fund - Regular Plan - Growth
  143493,  // Nippon India Ultra Short Duration Fund- Growth Option
  144171,  // BANDHAN ULTRA SHORT DURATION FUND - REGULAR PLAN GROWTH
  144759,  // Axis Ultra Short Duration Fund - Regular Plan Growth
  145040,  // HDFC Ultra Short Term Fund - Growth Option
  145952,  // LIC MF Short Duration Fund-Regular Plan-Growth
  146070,  // Tata Ultra Short Term Fund-Regular Plan-Growth
  147307,  // WhiteOak Capital Ultra Short Duration Fund- Regular plan-Growth Option
  147425,  // Sundaram Ultra Short Term Fund Regular Plan - Growth
  147674,  // Nippon India Ultra Short Duration Fund - Segregated Portfolio 1 - Grow
  147734,  // Mahindra Manulife Ultra Short Duration Fund - Regular Plan - Growth
  147770,  // LIC MF Ultra Short Duration Fund-Regular Plan-Growth
  147907,  // HSBC Ultra Short Duration Fund - Regular Growth
  148530,  // Mirae Asset Ultra Short Duration Fund Regular Growth
  148727,  // Mahindra Manulife Short Duration Fund - Regular Plan - Growth
  148906,  // ITI Ultra Short Duration Fund - Regular Plan - Growth Option
  149073,  // TRUSTMF Short Duration Fund-Regular Plan-Growth
  149535,  // Sundaram Ultra Short Duration Fund (Formerly Known as Principal Ultra
  149585,  // Sundaram Short Duration Fund (Formerly Known as Principal Short Term D
  150542,  // JM Short Duration Fund (Regular) - Growth
  151065,  // HSBC Short Duration Fund - Regular Growth
  152828,  // Franklin India Ultra Short Duration Fund - Growth
  153240,  // Union Short Duration Fund - Regular Plan - Growth Option
  // ─── MEDIUM DURATION (15 funds)
  100603,  // Sundaram Medium Duration Fund (Formerly Known as Sundaram Medium Term
  100608,  // Sundaram Medium Duration Fund (Formerly Known as Sundaram Medium Term
  102053,  // SBI MEDIUM DURATION FUND - REGULAR PLAN - GROWTH
  108728,  // Bandhan Medium Duration Fund - Regular Plan - Growth
  130037,  // Nippon India Medium Duration Fund - Growth Option
  134499,  // UTI Medium Duration Fund - Regular Plan - Growth Option
  148286,  // Nippon India Medium Duration Fund - Segregated Portfolio 2 - Growth Op
  148477,  // Union Medium Duration Fund - Regular Plan -  Growth Option
  149012,  // Invesco India Medium Duration Fund - Regular Plan - Growth
  150240,  // BARODA BNP PARIBAS Medium Duration Fund - Regular Plan - Growth Option
  150291,  // Baroda BNP Paribas Medium Duration Fund - Regular Plan - Growth - Segr
  150301,  // Baroda BNP Paribas Medium Duration Fund - Defunct Plan - Growth Option
  151149,  // HSBC Medium Duration Fund - Regular Growth
  152892,  // Baroda BNP Paribas Credit risk fund -Defunct -Growth option -Seg-Portf
  152904,  // Baroda BNP Paribas Credit Risk fund -Regular-Growth -Seg. Portfolio 2
  // ─── MEDIUM TO LONG DURATION (7 funds)
  100223,  // JM Medium to Long Duration Fund (Regular) - Growth Option
  100315,  // LIC MF Medium to Long Duration Fund-Regular Plan-Growth
  100639,  // SBI Medium to Long Duration Fund-REGULAR PLAN-Growth
  100741,  // UTI Medium to Long Duration Fund- Regular Plan - Growth
  101685,  // HSBC Medium to Long Duration Fund - Regular Growth
  108765,  // Bandhan Medium to Long Duration Fund - Regular Plan - Growth
  152853,  // Franklin India Medium to Long Duration Fund - Growth
  // ─── LONG DURATION (16 funds)
  100223,  // JM Medium to Long Duration Fund (Regular) - Growth Option
  100315,  // LIC MF Medium to Long Duration Fund-Regular Plan-Growth
  100639,  // SBI Medium to Long Duration Fund-REGULAR PLAN-Growth
  100741,  // UTI Medium to Long Duration Fund- Regular Plan - Growth
  101685,  // HSBC Medium to Long Duration Fund - Regular Growth
  108765,  // Bandhan Medium to Long Duration Fund - Regular Plan - Growth
  143702,  // Nippon India Nivesh Lakshya Long Duration Fund- Growth Option
  150482,  // Aditya Birla Sun Life Long Duration Fund-Regular Growth
  151178,  // Axis Long Duration Fund - Regular Plan - Growth
  151212,  // SBI Long Duration Fund - Regular Plan - Growth
  151527,  // UTI Long Duration Fund - Regular Plan - Growth Option
  152489,  // Kotak Long Duration Fund - Regular Plan - Growth
  152518,  // Bandhan Long Duration Fund - Regular Plan - Growth
  152853,  // Franklin India Medium to Long Duration Fund - Growth
  153104,  // Franklin India Long Duration Fund - Growth
  153107,  // Mirae Asset Long Duration Fund - Regular Plan - Growth
  // ─── DYNAMIC BOND (35 funds)
  100963,  // Principal Dynamic Bond Fund - Growth Option
  101279,  // Grindlays Dynamic Bond Fund - GDBF (Growth)
  101806,  // JM Dynamic Bond Fund (Regular) - Growth Option
  101909,  // Tata Dynamic Bond Fund- Regular Plan - Growth Option
  101910,  // Tata Dynamic Bond Fund B - Growth
  102205,  // SBI Dynamic Bond Fund - REGULAR PLAN - Growth
  102767,  // Aditya Birla Sun Life Dynamic Bond Fund - Growth - Regular Plan
  102849,  // Nippon India Dynamic Bond Fund-Growth Plan-Growth Option
  108511,  // Kotak Dynamic Bond Fund Regular Plan Growth
  108786,  // IDFC Dynamic Bond Fund - Growth
  111524,  // BANDHAN Dynamic Bond Fund - Regular Plan B - Growth
  111848,  // Aditya Birla Sun Life Dynamic Bond Fund-Discipline Advantage Plan-Grow
  111961,  // Canara Robeco Dynamic Bond Fund - Institutional Plan - Growth
  111962,  // CANARA ROBECO DYNAMIC BOND FUND - REGULAR PLAN - GROWTH OPTION
  111996,  // ICICI Prudential Dynamic Bond Fund - Growth
  111999,  // ICICI Prudential Dynamic Bond Fund - Premium Growth
  112002,  // ICICI Prudential Dynamic Bond Fund - Premium Plus Growth
  113077,  // UTI Dynamic Bond Fund - Regular Plan - Growth Option
  115068,  // Axis Dynamic Bond Fund - Regular Plan - Growth Option
  116485,  // PGIM India Dynamic Bond Fund - Growth Option
  116555,  // Union Dynamic Bond Fund - Growth Option
  116583,  // IDBI Dynamic Bond Fund Growth
  117631,  // Baroda Dynamic Bond Fund - Plan A - Growth Option
  122612,  // 360 ONE Dynamic Bond Fund - Regular Plan - Growth Option
  140771,  // Mirae Asset Dynamic Bond Fund-Regular Plan Growth
  141061,  // Quantum Dynamic Bond Fund - Regular Plan Growth Option
  144401,  // Mahindra Manulife Dynamic Bond Fund - Regular Plan - Growth
  145590,  // Groww Dynamic Term Fund (formerly known as Indiabulls Dynamic Bond Fun
  147804,  // Aditya Birla Sun Life Dynamic Bond Fund- Segregated Portfolio 1- Growt
  147807,  // Aditya Birla Sun Life Dynamic Bond Fund-Segregated Portfolio 1- Discip
  148117,  // UTI - Dynamic Bond Fund (Segregated - 17022020) - Regular Plan - Growt
  149021,  // ITI Dynamic Bond Fund - Regular Plan - Growth Option
  150172,  // Baroda BNP Paribas Dynamic Bond Fund-Defunct Plan - Growth Option
  150173,  // Baroda BNP Paribas Dynamic Bond Fund - Regular Plan - Growth Option
  151084,  // HSBC Dynamic Bond Fund - Regular Growth
  // ─── CORPORATE BOND (35 funds)
  100789,  // Sundaram Corporate Bond Fund Regular Plan- Growth
  100792,  // Sundaram Corporate Bond Fund Institutional - Growth
  100856,  // Nippon India Corporate Bond Fund - Growth Plan - Growth Option
  102171,  // Principal Corporate Bond Fund -Growth
  103178,  // Aditya Birla Sun Life Corporate Bond Fund - Growth - Regular Plan
  106128,  // Tata Corporate Bond Fund Retail Investment Plan Growth
  106129,  // Tata Corporate Bond Fund -Regular Plan -  Growth
  106177,  // Invesco India Corporate Bond Fund - Regular Plan - Growth
  111972,  // ICICI Prudential Corporate Bond Fund Retail Growth
  111981,  // ICICI Prudential Corporate Bond Fund - Premium Growth
  111987,  // ICICI Prudential Corporate Bond Fund - Growth
  111993,  // ICICI Prudential Corporate Bond Fund - Super Premium Growth
  113070,  // HDFC Corporate Bond Fund - Growth Option
  114099,  // BNP PARIBAS Corporate Bond Fund - Regular Plan - Growth Option
  114101,  // BNP PARIBAS Corporate Bond Fund - Institutional Plan -Growth Option
  117951,  // BNP PARIBAS CORPORATE BOND FUND GROWTH OPTION
  126687,  // CANARA ROBECO CORPORATE BOND FUND - REGULAR PLAN - GROWTH OPTION
  133772,  // Kotak Corporate Bond Fund- Institutional Plan-Growth Option
  133782,  // Kotak Corporate Bond Fund- Regular Plan-Growth Option
  135914,  // BANDHAN Corporate Bond Fund - Regular Growth
  138318,  // PGIM India Corporate Bond Fund - Growth
  140336,  // Edelweiss Corporate Bond Fund - Regular Plan - Growth Option
  141593,  // Axis Corporate Bond Fund - Regular Plan Growth
  143239,  // Union Corporate Bond Fund - Regular Plan - Growth Option
  144345,  // UTI Corporate Bond Fund - Regular Plan - Growth Option
  144644,  // DSP Corporate Bond Fund - Regular - Growth
  146207,  // SBI Corporate Bond Fund - Regular Plan - Growth
  147392,  // Tata Corporate Bond Fund -Regular Plan-Growth(Segregated Portfolio 1)
  148496,  // HSBC Corporate Bond Fund - Regular Plan - Growth
  148757,  // Mirae Asset Corporate Bond Fund Regular Growth
  149351,  // Tata Corporate Bond Fund-Regular Plan-Growth
  150229,  // BARODA BNP PARIBAS Corporate Bond Fund - Defunct Plan - Growth Option
  150235,  // BARODA BNP PARIBAS CORPORATE BOND FUND - Regular Plan - GROWTH OPTION
  150992,  // HSBC Corporate Bond Fund - Regular Growth
  151322,  // TRUSTMF CORPORATE BOND FUND-REGULAR PLAN-GROWTH
  // ─── CREDIT RISK (34 funds)
  101837,  // DSP Credit Risk Fund - Regular Plan -Growth
  102505,  // SBI CREDIT RISK FUND - REGULAR PLAN - GROWTH
  102729,  // Principal Credit Risk Fund - Regular Plan - Growth Option
  112632,  // L&T Credit Risk Fund - Regular Plan - Growth
  112938,  // Nippon India Credit Risk Fund  - Growth Plan
  112939,  // Nippon India Credit Risk Fund  - Institutional Growth Plan
  114239,  // ICICI Prudential Credit Risk Fund - Growth
  116153,  // Franklin India Credit Risk Fund - Growth
  117716,  // Kotak Credit Risk Fund - Growth
  117981,  // UTI Credit Risk Fund  - Regular Plan - Growth Option
  127183,  // IDBI Credit Risk Fund Growth Regular
  130309,  // Axis Credit Risk Fund - Regular Plan - Growth
  130721,  // Invesco India Credit Risk Fund - Regular Plan - Growth
  133486,  // Baroda BNP Paribas Credit Risk Fund -Regular-Growth Option
  134383,  // Aditya Birla Sun Life Credit Risk Fund - Regular Plan - Growth
  138905,  // PGIM India Credit Risk Fund - Regular Plan - Growth
  140609,  // BANDHAN Credit Risk Fund - Regular Plan Growth
  147650,  // UTI - Credit Risk Fund (Segregated - 13092019) - Regular Plan - Growth
  147798,  // Aditya Birla Sun Life Credit Risk Fund- Segregated Portfolio 1-Regular
  147954,  // Franklin India Credit Risk Fund- Segregated Portfolio 1- 8.25% Vodafon
  147961,  // Franklin India Credit Risk Fund- Segregated Portfolio 2- 10.90% Vodafo
  148094,  // Nippon India Credit Risk Fund - Segregated Portfolio 1 - Growth Plan
  148100,  // Nippon India Credit Risk Fund - Segregated Portfolio 1 - Institutional
  148146,  // UTI - Credit Risk Fund (Segregated - 17022020) - Regular Plan - Growth
  148217,  // PGIM India Credit Risk Fund - Segregated Portfolio 1 - Regular Plan Gr
  148237,  // UTI - Credit Risk Fund (Segregated - 06032020) - Regular Plan - Growth
  148258,  // Nippon India Credit Risk Fund - Segregated Portfolio 2 - Growth Plan
  148259,  // Nippon India Credit Risk Fund - Segregated Portfolio 2 - Institutional
  148303,  // Franklin India Credit Risk Fund - Segregated Portfolio 3 (9.50% Yes Ba
  148330,  // Baroda BNP Paribas Credit Risk Fund- Regular- Growth Option- Segregate
  148425,  // UTI - Credit Risk Fund (Segregated - 07072020) - Regular Plan - Growth
  151043,  // HSBC Credit Risk Fund - Regular Growth
  152892,  // Baroda BNP Paribas Credit risk fund -Defunct -Growth option -Seg-Portf
  152904,  // Baroda BNP Paribas Credit Risk fund -Regular-Growth -Seg. Portfolio 2
  // ─── BANKING & PSU (36 funds)
  100781,  // Sundaram Banking & PSU Fund (Formerly Known as Sundaram Banking and PS
  100784,  // Sundaram Banking & PSU Fund (Formerly Known as Sundaram Banking and PS
  103176,  // Aditya Birla Sun Life Banking & PSU Debt Fund - Retail Plan-Growth
  103188,  // Aditya Birla Sun Life Banking & PSU Debt Fund - Growth - Regular Plan
  105823,  // LIC MF Banking & PSU Fund-Regular Plan-Growth
  108273,  // Aditya Birla Sun Life Banking & PSU Debt Fund - Regular Plan-Growth
  112342,  // ICICI Prudential Banking and PSU Debt Fund - Growth
  113242,  // ICICI Prudential Banking and PSU Debt Fund Retail Growth
  113244,  // ICICI Prudential Banking and PSU Debt Fund Premium Growth
  117446,  // Axis Banking & PSU Debt Fund - Regular Plan - Growth option
  118071,  // L&T Banking and PSU Debt Fund - Institutional Plan - Growth Option
  118074,  // L&T Banking and PSU Debt Fund - Retail Plan - Growth Option
  118078,  // L&T Banking and PSU Debt Fund - Regular Plan - Growth
  118232,  // Invesco India Banking and PSU Fund - Regular Plan - Growth Option
  121270,  // DWS Banking and PSU Debt fund -Growth
  121280,  // Bandhan Banking and PSU Fund - Regular Growth
  123690,  // Kotak Banking and PSU Debt - Growth
  123902,  // JPMorgan India Banking and PSU Debt Fund - Regular Plan - Growth Optio
  124172,  // DSP Banking & PSU Debt Fund - Regular Plan - Growth
  125498,  // SBI BANKING & PSU FUND - Regular Paln - Growth
  126939,  // UTI Banking & PSU Fund- Regular Plan - Growth Option
  128628,  // HDFC Banking and PSU Debt Fund - Growth Option
  129006,  // Franklin India Banking & PSU Debt Fund - Growth
  134356,  // Sundaram Banking & PSU Debt Fund - Regular Growth
  134545,  // Nippon India Banking and PSU Fund- Growth Plan- Growth Option
  138566,  // PGIM India Banking and PSU Debt fund -Growth
  140283,  // Edelweiss Banking and PSU Debt Fund - Regular Plan - Growth Option
  147223,  // Indiabulls Banking & PSU Debt Fund- Regular Plan- Growth Option
  147635,  // Tata Banking & PSU Debt Fund-Regular Plan-Growth
  148416,  // Mirae Asset Banking and PSU Fund - Regular Plan - Growth
  148535,  // ITI Banking & PSU Debt Fund - Regular Plan - Growth Option
  148625,  // Baroda BNP Paribas Banking and PSU Bond Fund-Regular Plan -Growth Opti
  148655,  // TRUSTMF BANKING & PSU FUND - REGULAR GROWTH
  150503,  // Canara Robeco Banking and PSU Debt Fund- Regular Plan- Growth Option
  151104,  // HSBC Banking and PSU Debt Fund - Regular Growth
  152165,  // Bajaj Finserv Banking and PSU Fund- Regular Plan- Growth
  // ─── GILT (60 funds)
  100061,  // Aditya Birla Sun Life Constant Maturity 10 Year Gilt Fund - Growth - R
  100084,  // DSP Gilt Fund - Regular Plan - Growth
  100317,  // LIC MF Gilt Fund-Regular Plan-Growth
  100319,  // LIC MF Gilt Fund-PF Plan-Growth
  100369,  // ICICI Prudential Gilt Fund - Growth
  100371,  // ICICI Prudential Short Term Gilt Fund - Growth
  100597,  // CANARA ROBECO GILT FUND - REGULAR PLAN - GROWTH OPTION
  101001,  // SBI GILT FUND - REGULAR PLAN - GROWTH
  101002,  // SBI CONSTANT MATURITY 10 Year GILT FUND - REGULAR PLAN - GROWTH
  101082,  // HDFC Gilt Fund-Short Term-Growth
  101083,  // HDFC Gilt Fund - Growth Plan
  101092,  // SUNDARAM GILT FUND (Growth. OPTION)
  101095,  // Taurus Gilt Fund-Growth
  101120,  // Principal Gilt Fund-Savings-Growth
  101122,  // Principal Gilt Fund-Provident-Growth
  101170,  // Sahara Gilt Fund-Growth
  101187,  // Baroda BNP Paribas GILT FUND - Regular Plan - Growth Option
  101190,  // BOB GILT FUND-PF Plan (Growth)
  101333,  // FT India Gilt Fund-*Liquid Plan - Growth
  101405,  // ING Gilt Fund-Growth Option
  101876,  // HDFC Sovereign Gilt Fund - Savings Plan-Growth Option
  101878,  // HDFC Sovereign Gilt Fund - Provident Plan-Growth Option
  101932,  // SBI GILT FUND -  GROWTH - PF (Regular) Option
  101933,  // SBI MAGNUM GILT FUND -  GROWTH - PF (Fixed Period - 2 Yrs) Option
  101934,  // SBI GILT FUND -  GROWTH - PF (Fixed Period - 3 Yrs) Option
  101991,  // HDFC Sovereign Gilt Fund - Investment Plan-Growth Option
  102060,  // ICICI Prudential Gilt Fund Investment Plan PF Option - Growth
  102061,  // SBI MAGNUM GILT FUND -  GROWTH - PF (Fixed Period - 1 Yr) Option
  102066,  // HSBC Gilt Fund  - Growth
  102248,  // ICICI Prudential Gilt Fund Treasury Plan PF Option - Growth
  102381,  // ING Gilt Fund Provident Fund - Dynamic Plan-Growth Option
  102510,  // UTI - GILT FUND - Regular Plan - Growth Option
  102512,  // UTI - GILT FUND - Discontinued PF Plan - Growth Option
  107475,  // Religare Invesco GILT Fund - Long Duration Plan - Institutional-Growth
  107477,  // Invesco India Gilt Fund - Regular Plan - Growth
  107481,  // Religare Invesco GILT Fund - Short Duration Plan - Growth
  107484,  // Religare Invesco GILT Fund - Short Duration Plan - Institutional - Gro
  108753,  // Bandhan Gilt Fund with 10 year constant duration Fund - Regular Plan -
  109556,  // Fidelity Flexi Gilt Fund - Growth Option
  110704,  // DWS Gilt Fund - Institutional Plan - Growth
  110706,  // DWS Gilt Fund - Growth
  111525,  // Bandhan Gilt Fund - Regular Plan - Growth
  111682,  // Mirae Asset Gilt Fund Savings Plan - Regular Growth
  111684,  // Mirae Asset Gilt Fund Savings Plan - Institutional Growth
  111692,  // Mirae Asset Gilt Fund Investment Plan - Regular Growth
  111698,  // Mirae Asset Gilt Fund Investment Plan - Institutional Growth
  112054,  // Edelweiss Gilt Fund - Growth Option
  112429,  // L&T Gilt Fund - Regular Plan - Growth
  116203,  // MOSt 10 Year Gilt Fund - Growth
  116471,  // Axis Gilt Fund - Regular Plan - Growth Option
  118030,  // IDBI Gilt Fund Growth
  121622,  // Morgan Stanley Gilt Fund - Regular Growth
  131051,  // ICICI Prudential Constant Maturity Gilt Fund - Growth
  138470,  // PGIM India Gilt Fund - Growth
  150405,  // Union Gilt Fund - Regular Plan - Growth Option
  150409,  // UTI Gilt Fund with 10 year Constant Duration - Regular Plan - Growth O
  151013,  // HSBC Gilt Fund - Regular Growth
  151230,  // quant Gilt Fund - Growth Option - Regular Plan
  153211,  // Bajaj Finserv Gilt Fund - Regular - Growth
  153503,  // Groww Gilt Fund - Regular - Growth
  // ─── GILT 10 YEAR (5 funds)
  100061,  // Aditya Birla Sun Life Constant Maturity 10 Year Gilt Fund - Growth - R
  101002,  // SBI CONSTANT MATURITY 10 Year GILT FUND - REGULAR PLAN - GROWTH
  111339,  // IDFC GSF - Constant Maturity Plan -Plan B Growth
  116203,  // MOSt 10 Year Gilt Fund - Growth
  131051,  // ICICI Prudential Constant Maturity Gilt Fund - Growth
  // ─── FLOATER (23 funds)
  101048,  // Franklin India Floating Rate Fund - Growth Plan
  101630,  // Grindlays Floating Rate Fund - Growth
  102155,  // Tata Floating Rate Fund - Long Term Plan- Regular Plan - Growth
  102268,  // LIC NOMURA MF Floating Rate Fund - Short Term Plan-Growth
  102673,  // Nippon India Floater Fund - Growth Plan-Growth Option
  102725,  // Principal Floating Rate Fund - SMP-Growth
  102827,  // HSBC Floating Rate Fund - Long Term - Regular - Growth
  102829,  // HSBC Floating Rate Fund - Long Term - Growth
  102832,  // HSBC Floating Rate Fund - Short Term - Regular - Growth
  102835,  // HSBC Floating Rate Fund - Short Term - Inst. - Growth
  102839,  // HSBC Floating Rate Fund - Short Term - Inst. Plus - Growth
  116685,  // DHFL PRAMERICA SHORT TERM FLOATING RATE FUND - GROWTH
  122644,  // Aditya Birla Sun Life Floating Rate Fund-Regular Plan-Growth
  122650,  // Aditya Birla Sun Life Floating Rate Fund-Retail Plan-Growth
  138481,  // DHFL Pramerica Floating Rate Fund - Growth
  138482,  // DHFL Pramerica Floating Rate Fund- Institiutional - Growth
  145287,  // UTI - Floater Fund - Regular Plan  - Growth Option
  147266,  // KOTAK FLOATING RATE FUND-REGULAR PLAN-GROWTH OPTION
  148705,  // BANDHAN FLOATER FUND  - REGULAR PLAN GROWTH
  148768,  // DSP Floater Fund - Regular Plan - Growth
  149003,  // Tata Floating Rate Fund-Regular Plan-Growth
  149048,  // Axis Floater Fund - Regular Plan - Growth
  151734,  // Baroda BNP Paribas Floater Fund - Regular Plan - Growth option
  // ─── INTERNATIONAL/FOF (75 funds)
  101656,  // Franklin India Dynamic Asset Allocation Active Fund of Funds-Growth
  102456,  // Benchmark Fund of Funds-Nifty BeES Plan-Growth
  102458,  // Benchmark Fund of Funds-Junior BeES Plan-Growth
  102460,  // Benchmark Fund of Funds-Nifty 100 Plan-Growth
  102462,  // Benchmark Fund of Funds-Nifty Balanced Plan-Growth
  103283,  // Kotak Flexi Fund of Funds---Growth
  103792,  // Kotak Flexi Fund of Fund-Series I-Growth
  115934,  // HDFC Gold ETF Fund of Fund - Growth Option
  116077,  // Invesco India Gold ETF Fund of Fund - Regular Plan - Growth
  116633,  // Franklin U.S. Opportunities Equity Active Fund of Funds - Growth
  126351,  // Invesco India - Invesco Pan European Equity Fund of Fund - Regular Pla
  129187,  // Invesco India - Invesco Global Equity Income Fund of Fund - Regular Pl
  132005,  // Aditya Birla Sun Life Global Excellence Equity Fund Of Fund- Retail Pl
  132987,  // Franklin India Income Plus Arbitrage Active Fund of Funds- Growth Plan
  138453,  // PGIM India Emerging Markets Equity Fund of Fund- Growth
  138523,  // PGIM India Global Equity Opportunities Fund of Fund- Growth
  145551,  // Motilal Oswal Nasdaq 100 Fund of Fund- Regular Plan Growth
  148064,  // Edelweiss US Technology Equity Fund of Fund- Regular Plan- Growth
  148486,  // Axis Global Equity Alpha Fund of Fund - Regular Plan - Growth Option
  148576,  // Mirae Asset Nifty 100 ESG Sector Leaders Fund of Fund Regular Growth
  148613,  // Invesco India - Invesco Global Consumer Trends Fund of Fund - Regular
  148701,  // Axis Greater China Equity Fund of Fund - Regular Plan - Growth Option
  148735,  // HSBC Global Equity Climate Change Fund of Fund - Regular - Growth
  148896,  // BNP Paribas Funds Aqua Fund of Fund - Regular Plan Growth
  148929,  // Mirae Asset NYSE FANG + ETF Fund of Fund Regular Growth
  148953,  // Axis Global Innovation Fund of Fund - Regular Plan - Growth
  149056,  // Kotak Global Innovation Overseas Equity Omni FOF - Regular Plan-Growth
  149171,  // Mirae Asset S&P 500 Top 50 ETF Fund of Fund Regular Growth
  149218,  // ICICI Prudential NASDAQ 100 Index Fund - Growth
  149241,  // Motilal Oswal 5 Year G-Sec Fund Of Fund Regular -Growth
  149299,  // PGIM India Global Select Real Estate Securities Fund of Fund - Regular
  149380,  // Mirae Asset Hang Seng TECH ETF Fund of Fund Regular Plan - Growth Opti
  149439,  // ICICI Prudential Passive Multi-Asset Fund of Funds - Growth
  149456,  // ICICI Prudential Strategic Metal and Energy Equity Fund of Fund - Grow
  149817,  // DSP Global Innovation Overseas Equity Omni FoF - Regular - Growth
  149911,  // Navi NASDAQ100 US Specific Equity Passive FOF- Regular- Growth
  149960,  // Invesco India - Invesco EQQQ Nasdaq-100 ETF Fund of Fund - Regular Pla
  150284,  // Baroda BNP Paribas Aqua Fund of Fund - Regular Plan Growth
  150345,  // Tata Nifty India Digital ETF Fund of Fund -Regular Plan-Growth
  150389,  // Quantum Nifty 50 ETF Fund of Fund - Regular Plan - Growth
  150596,  // Mirae Asset Global X Artificial Intelligence & Technology ETF Fund of
  150617,  // Axis Silver Fund of Fund -Regular Plan- Growth Option
  150715,  // UTI Gold ETF Fund of Fund - Regular Plan - Growth Opton
  150736,  // HDFC Silver ETF Fund of Fund - Growth Option
  150750,  // Axis NASDAQ 100 US Specific Equity Passive FOF - Regular Plan - Growth
  151602,  // Kotak Silver ETF Fund of Fund - Regular Plan - Growth Option
  151732,  // UTI Silver ETF Fund of Fund - Regular Plan - Growth Option
  151973,  // LIC MF Gold ETF Fund of Fund-Regular Plan-Growth
  152091,  // Motilal Oswal Developed Market Ex US ETFs Fund of Funds Regular Plan G
  152142,  // Aditya Birla Sun Life US Treasury 1-3 Year Bond ETFs Fund Of Funds-Reg
  152147,  // Aditya Birla Sun Life US Treasury 3-10 Year Bond ETFs Fund Of Funds-Re
  152182,  // DSP Gold ETF Fund of Fund - Regular - Growth
  152290,  // Tata Gold ETF Fund of Fund Regular Plan Growth Option
  152297,  // Tata Silver ETF Fund of Fund Regular Plan Growth Option
  152457,  // Mirae Asset Nifty Smallcap 250 Momentum Quality 100 ETF Fund of Fund -
  152647,  // Mirae Asset Nifty MidSmallcap400 Momentum Quality 100 ETF Fund of Fund
  152720,  // Mirae Asset Nifty200 Alpha 30 ETF Fund of Fund - Regular Plan - Growth
  152733,  // SBI Silver ETF Fund of Fund- Regular Plan - Growth
  153009,  // Mirae Asset Gold ETF Fund of Fund - Regular Plan - Growth
  153194,  // Mirae Asset Nifty India New Age Consumption ETF Fund of Fund - Regular
  153338,  // Union Gold ETF Fund of Fund - Regular Plan - Growth Option
  153382,  // Mirae Asset BSE 200 Equal Weight ETF Fund of Fund - Regular Plan - Gro
  153387,  // Mirae Asset BSE Select IPO ETF Fund of Fund - Regular Plan - Growth
  153441,  // UTI Income Plus Arbitrage Active Fund of Fund - Regular Plan - Growth
  153486,  // DSP Silver ETF Fund of Fund - Regular - Growth
  153601,  // Nippon India Income Plus Arbitrage Active Fund of Fund -Regular Plan-
  153695,  // Invesco India Income Plus Arbitrage Active Fund of Fund - Regular Plan
  153713,  // Edelweiss Income Plus Arbitrage Active Fund of Funds - Regular-Growth
  153779,  // Edelweiss Multi Asset Omni Fund of Fund- Regular Plan - Growth
  153794,  // Baroda BNP Paribas Gold ETF Fund of Funds Regular Growth
  154075,  // Edelweiss Silver ETF Fund of Fund - Regular Plan Growth Option
  154113,  // Motilal Oswal Diversified Equity Flexicap Passive Fund of funds- Regul
  154165,  // DSP Multi Asset Omni Fund of Funds - Regular - Growth
  154209,  // Edelweiss Gold ETF Fund of Fund Regular Plan Growth Option
  154298,  // HSBC Gold ETF Fund of fund - Regular Growth
]

// Deduplicate
const ALL_CODES = [...new Set(SCHEME_CODES)]

// ── Helpers ────────────────────────────────────────────────────────────────────

function shouldInclude(name: string): boolean {
  const n = name.toLowerCase()
  return !n.includes('direct') && !n.includes('idcw') &&
         !n.includes('dividend') && !n.includes('bonus') && !n.includes('payout')
}

function detectPlanType(name: string): 'Regular' | 'Direct' {
  return name.toLowerCase().includes('direct') ? 'Direct' : 'Regular'
}

function detectOptionType(name: string): 'Growth' | 'IDCW' {
  const n = name.toLowerCase()
  return (n.includes('idcw') || n.includes('dividend')) ? 'IDCW' : 'Growth'
}

function extractAmc(name: string): string {
  const AMC_KEYWORDS = ['mutual fund', 'mf', 'asset management', 'amc', 'fund', 'schemes']
  const words = name.split(' ')
  const result: string[] = []
  for (const word of words) {
    if (AMC_KEYWORDS.some(k => word.toLowerCase().includes(k))) {
      result.push(word); break
    }
    result.push(word)
    if (result.length >= 3) break
  }
  return result.join(' ').trim()
}

function extractCategory(name: string): string {
  const n = name.toUpperCase()
  if (n.includes('LIQUID'))                                        return 'Liquid'
  if (n.includes('OVERNIGHT'))                                     return 'Overnight'
  if (n.includes('ULTRA SHORT'))                                   return 'Ultra Short Duration'
  if (n.includes('LOW DURATION'))                                  return 'Low Duration'
  if (n.includes('SHORT DURATION') || n.includes('SHORT TERM'))   return 'Short Duration'
  if (n.includes('MEDIUM DURATION'))                               return 'Medium Duration'
  if (n.includes('LONG DURATION'))                                 return 'Long Duration'
  if (n.includes('GILT'))                                          return 'Gilt'
  if (n.includes('CREDIT RISK'))                                   return 'Credit Risk'
  if (n.includes('CORPORATE BOND'))                                return 'Corporate Bond'
  if (n.includes('BANKING AND PSU') || n.includes('BANKING & PSU')) return 'Banking and PSU'
  if (n.includes('DYNAMIC BOND'))                                  return 'Dynamic Bond'
  if (n.includes('FLOATER') || n.includes('FLOATING RATE'))       return 'Floater'
  if (n.includes('MONEY MARKET'))                                  return 'Money Market'
  if (n.includes('ARBITRAGE'))                                     return 'Arbitrage'
  if (n.includes('EQUITY SAVINGS'))                                return 'Equity Savings'
  if (n.includes('BALANCED ADVANTAGE') || n.includes('DYNAMIC ASSET')) return 'Balanced Advantage'
  if (n.includes('AGGRESSIVE HYBRID'))                             return 'Aggressive Hybrid'
  if (n.includes('CONSERVATIVE HYBRID'))                           return 'Conservative Hybrid'
  if (n.includes('MULTI ASSET'))                                   return 'Multi Asset Allocation'
  if (n.includes('ELSS') || n.includes('TAX SAVER') || n.includes('TAX SAVING')) return 'ELSS'
  if (n.includes('INDEX') || n.includes('NIFTY') || n.includes('SENSEX') || n.includes('BSE')) return 'Index Fund'
  if (n.includes('ETF'))                                           return 'ETF'
  if (n.includes('FUND OF FUND') || n.includes('FOF') || n.includes('FEEDER')) return 'Fund of Funds'
  if (n.includes('INTERNATIONAL') || n.includes('GLOBAL') || n.includes('OVERSEAS') || n.includes('NASDAQ') || n.includes('US ')) return 'International'
  if (n.includes('GOLD') || n.includes('SILVER'))                 return 'Commodity'
  if (n.includes('SMALL CAP'))                                     return 'Small Cap'
  if (n.includes('MID CAP') || n.includes('MIDCAP'))              return 'Mid Cap'
  if (n.includes('LARGE CAP') || n.includes('LARGECAP'))          return 'Large Cap'
  if (n.includes('LARGE & MID') || n.includes('LARGE AND MID'))   return 'Large & Mid Cap'
  if (n.includes('MULTI CAP') || n.includes('MULTICAP'))          return 'Multi Cap'
  if (n.includes('FLEXI CAP') || n.includes('FLEXICAP'))          return 'Flexi Cap'
  if (n.includes('FOCUSED'))                                       return 'Focused'
  if (n.includes('VALUE') || n.includes('CONTRA'))                return 'Value/Contra'
  if (n.includes('THEMATIC') || n.includes('SECTORAL') || n.includes('BANKING & FINANCIAL') || n.includes('PHARMA') || n.includes('TECHNOLOGY') || n.includes('INFRASTRUCTURE') || n.includes('MANUFACTURING') || n.includes('CONSUMPTION') || n.includes('MNC') || n.includes('PSU')) return 'Thematic/Sectoral'
  return 'Other'
}

function progressBar(current: number, total: number, width = 40): string {
  const pct = current / total
  const filled = Math.round(width * pct)
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${String(current).padStart(4)}/${total} (${Math.round(pct * 100)}%)`
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║   MF Platform — ENGINE 1: SYNC SCHEMES              ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`  Scheme codes  : ${ALL_CODES.length} (curated list)`)
  console.log(`  Started       : ${new Date().toLocaleString('en-IN')}\n`)

  console.log('  📡 Fetching all schemes from mfapi.in...')
  const res = await fetch(MFAPI)
  if (!res.ok) throw new Error(`mfapi failed: ${res.status}`)
  const allSchemes: { schemeCode: number; schemeName: string }[] = await res.json()

  // Build a lookup map from the full mfapi list
  const apiMap = new Map<number, string>()
  for (const s of allSchemes) apiMap.set(s.schemeCode, s.schemeName)

  console.log(`  API returned   : ${allSchemes.length} total schemes`)
  console.log(`  Building records for curated ${ALL_CODES.length} codes...\n`)

  const records: object[] = []
  let notFound = 0

  for (const code of ALL_CODES) {
    const name = apiMap.get(code)
    if (!name) { notFound++; continue }
    if (!shouldInclude(name)) continue
    records.push({
      scheme_code:  code,
      scheme_name:  name,
      amc:          extractAmc(name),
      category:     extractCategory(name),
      plan_type:    detectPlanType(name),
      option_type:  detectOptionType(name),
      is_active:    true,
    })
  }

  console.log(`  Records built  : ${records.length}`)
  console.log(`  Not in API     : ${notFound} (old/delisted codes)`)
  console.log(`\n  📥 Upserting into Supabase...\n`)

  let done = 0
  for (let i = 0; i < records.length; i += CHUNK) {
    const batch = records.slice(i, i + CHUNK)
    const { error } = await supabase.from('schemes').upsert(batch as any, { onConflict: 'scheme_code' })
    if (error) throw error
    done += batch.length
    process.stdout.write(`\r  ${progressBar(done, records.length)}`)
    await sleep(DELAY)
  }

  console.log('\n\n╔══════════════════════════════════════════════════════╗')
  console.log('║  SCHEME SYNC COMPLETE                                ║')
  console.log(`║  Upserted : ${String(records.length).padEnd(42)}║`)
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('\n  ✅ Run "npm run mf:nav" next.\n')
}

main().catch(e => { console.error('\n  FATAL:', e.message); process.exit(1) })
