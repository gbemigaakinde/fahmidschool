/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Mathematics Competition – Questions Bank
 * Based on Lagos State Unified Scheme of Work (Primary 1–5)
 *
 * Format per question:
 *   { id, q, opts: [A,B,C,D], ans: "A"|"B"|"C"|"D", type: "mcq"|"theory" }
 *
 * Rules:
 *   - All MCQs have exactly 4 options labelled A–D
 *   - Correct answers are distributed across A/B/C/D (no repetition bias)
 *   - Questions must be difficult / non-trivial for the class level
 *   - Theory questions (for tie-breaker) are open-ended short-answer
 *   - At least 30 MCQs and 10 theory questions per class (well above the max needed)
 */

'use strict';

window.QUESTIONS = {

  /* ============================================================
     PRIMARY 1
     Topics: Whole Numbers (1–100+), Addition/Subtraction (≤20+),
     Skip Counting, Ordinal Numbers, Basic Shapes, Simple Money,
     Comparison, Doubles, Simple Patterns
  ============================================================ */
  P1: {
    mcq: [
      { id:"p1m001", q:"Which number comes just BEFORE 19?", opts:["16","17","18","20"], ans:"C" },
      { id:"p1m002", q:"What is the VALUE of the digit 6 in the number 65?", opts:["6","60","5","65"], ans:"B" },
      { id:"p1m003", q:"Tunde has 8 oranges. He gives 3 away. How many oranges remain?", opts:["11","4","5","3"], ans:"C" },
      { id:"p1m004", q:"Which number is the LARGEST? 23, 32, 22, 30", opts:["23","22","30","32"], ans:"D" },
      { id:"p1m005", q:"Count by 5s: 5, 10, 15, ___, 25. What fills the blank?", opts:["18","19","20","22"], ans:"C" },
      { id:"p1m006", q:"A shape with THREE sides and THREE corners is called a:", opts:["Circle","Square","Triangle","Rectangle"], ans:"C" },
      { id:"p1m007", q:"What is DOUBLE of 7?", opts:["12","14","13","16"], ans:"B" },
      { id:"p1m008", q:"9 + __ = 17. What is the missing number?", opts:["6","9","7","8"], ans:"D" },
      { id:"p1m009", q:"Which is the FOURTH number when counting: 2, 4, 6, 8, 10?", opts:["6","10","2","8"], ans:"D" },
      { id:"p1m010", q:"Amaka counted 15 pens and 6 pencils. How many items altogether?", opts:["20","21","9","19"], ans:"B" },
      { id:"p1m011", q:"If I skip-count in 2s starting from 4, what are the next TWO numbers?", opts:["5 and 6","6 and 8","7 and 9","8 and 10"], ans:"B" },
      { id:"p1m012", q:"A book costs ₦10 and a pencil costs ₦4. How much do they cost TOGETHER?", opts:["₦6","₦14","₦16","₦15"], ans:"B" },
      { id:"p1m013", q:"Which shape has NO corners at all?", opts:["Square","Triangle","Rectangle","Circle"], ans:"D" },
      { id:"p1m014", q:"20 − 13 = ?", opts:["6","8","7","9"], ans:"C" },
      { id:"p1m015", q:"In the number 47, which digit is in the TENS place?", opts:["7","4","47","0"], ans:"B" },
      { id:"p1m016", q:"If there are 5 rows of 2 chairs each, how many chairs in total?", opts:["7","3","8","10"], ans:"D" },
      { id:"p1m017", q:"Sola is THIRD in a queue of 10 children. How many children are BEHIND her?", opts:["3","7","8","6"], ans:"B" },
      { id:"p1m018", q:"What comes NEXT in the pattern: 1, 3, 5, 7, ___?", opts:["8","10","9","11"], ans:"C" },
      { id:"p1m019", q:"Which number is an ODD number?", opts:["12","18","15","20"], ans:"C" },
      { id:"p1m020", q:"A box holds 10 sweets. Two boxes hold how many sweets?", opts:["12","15","20","5"], ans:"C" },
      { id:"p1m021", q:"Write SEVENTEEN in numerals:", opts:["70","17","71","107"], ans:"B" },
      { id:"p1m022", q:"18 is the same as 10 + ___?", opts:["7","9","6","8"], ans:"D" },
      { id:"p1m023", q:"A rectangle has how many sides?", opts:["3","5","4","6"], ans:"C" },
      { id:"p1m024", q:"Count BACKWARD from 12: 12, 11, 10, ___, 8. What fills the blank?", opts:["7","9","6","11"], ans:"B" },
      { id:"p1m025", q:"If today is Tuesday, what day was YESTERDAY?", opts:["Sunday","Wednesday","Monday","Thursday"], ans:"C" },
      { id:"p1m026", q:"6 + 7 + 2 = ?", opts:["14","16","15","13"], ans:"C" },
      { id:"p1m027", q:"Which group shows SEVEN objects? ● ● ● ● ●  vs  ● ● ● ● ● ●  vs  ● ● ● ● ● ● ●  vs  ● ● ● ● ● ● ● ●", opts:["5 dots","6 dots","7 dots","8 dots"], ans:"C" },
      { id:"p1m028", q:"How many tens are in the number 30?", opts:["1","30","3","0"], ans:"C" },
      { id:"p1m029", q:"Which pair of numbers adds up to EXACTLY 20?", opts:["9 and 10","12 and 9","13 and 7","11 and 9"], ans:"C" },
      { id:"p1m030", q:"Eze bought 4 packs of biscuits. Each pack has 5 biscuits. How many biscuits altogether?", opts:["9","20","16","25"], ans:"B" },
      { id:"p1m031", q:"What number is 10 MORE than 24?", opts:["14","25","34","44"], ans:"C" },
      { id:"p1m032", q:"A week has ____ days.", opts:["5","6","7","8"], ans:"C" },
    ],
    theory: [
      { id:"p1t001", q:"Write the number SIXTY-THREE in figures and give the value of each digit.", ans:"63; tens digit = 6 (value 60), units digit = 3 (value 3)" },
      { id:"p1t002", q:"Shade has 9 red balls and 6 blue balls. She gives 4 balls away. How many balls does she have now?", ans:"11" },
      { id:"p1t003", q:"List ALL even numbers between 10 and 20 (not including 10 and 20).", ans:"12, 14, 16, 18" },
      { id:"p1t004", q:"A square has a side length of 3 cm. What is the total length of all its sides added together?", ans:"12 cm" },
      { id:"p1t005", q:"Skip count by 10s from 10 to 80. Write all the numbers.", ans:"10, 20, 30, 40, 50, 60, 70, 80" },
      { id:"p1t006", q:"17 − ? = 9. Find the missing number.", ans:"8" },
      { id:"p1t007", q:"Bisi is the 5th child in a row of 12 children. How many children are after her?", ans:"7" },
      { id:"p1t008", q:"Write these numbers in order from SMALLEST to LARGEST: 14, 5, 27, 9, 31.", ans:"5, 9, 14, 27, 31" },
      { id:"p1t009", q:"What is the sum of all odd numbers from 1 to 9?", ans:"25 (1+3+5+7+9)" },
      { id:"p1t010", q:"A rectangle has 2 long sides each 6 cm and 2 short sides each 3 cm. What is its perimeter?", ans:"18 cm" },
    ]
  },

  /* ============================================================
     PRIMARY 2
     Topics: Numbers to 500+, Addition/Subtraction 3-digit,
     Multiplication (×2,×3,×5,×10), Division, Fractions (halves/quarters),
     Place Value, Money, Measurement, Shapes
  ============================================================ */
  P2: {
    mcq: [
      { id:"p2m001", q:"What is 247 + 136?", opts:["373","383","375","383"], ans:"B" },
      { id:"p2m002", q:"What is the place value of 5 in the number 352?", opts:["5","500","50","0.5"], ans:"C" },
      { id:"p2m003", q:"Which number is 100 MORE than 289?", opts:["299","389","289","379"], ans:"B" },
      { id:"p2m004", q:"3 × 8 = ?", opts:["21","24","27","18"], ans:"B" },
      { id:"p2m005", q:"What is ONE QUARTER of 20?", opts:["10","4","5","8"], ans:"C" },
      { id:"p2m006", q:"450 − 127 = ?", opts:["323","333","327","313"], ans:"A" },
      { id:"p2m007", q:"Which fraction is GREATER than ½?", opts:["¼","⅓","¾","⅛"], ans:"C" },
      { id:"p2m008", q:"Multiply: 6 × 5 = ?", opts:["25","30","11","35"], ans:"B" },
      { id:"p2m009", q:"How many 5s make 45?", opts:["7","8","9","10"], ans:"C" },
      { id:"p2m010", q:"A ruler is 30 cm long. What is that in millimetres?", opts:["3 mm","300 mm","30 mm","3000 mm"], ans:"B" },
      { id:"p2m011", q:"Ify saved ₦150 on Monday and ₦230 on Tuesday. How much altogether?", opts:["₦370","₦380","₦360","₦390"], ans:"B" },
      { id:"p2m012", q:"Which of these numbers is DIVISIBLE by 2?", opts:["37","45","63","48"], ans:"D" },
      { id:"p2m013", q:"Count in 3s: 3, 6, 9, ___, 15. What fills the blank?", opts:["11","12","13","14"], ans:"B" },
      { id:"p2m014", q:"What is the VALUE of the digit 4 in 408?", opts:["4","40","400","4000"], ans:"C" },
      { id:"p2m015", q:"24 ÷ 4 = ?", opts:["4","6","8","7"], ans:"B" },
      { id:"p2m016", q:"Arrange in DESCENDING order: 207, 270, 72, 720", opts:["72,207,270,720","720,270,207,72","207,270,720,72","270,720,72,207"], ans:"B" },
      { id:"p2m017", q:"Which shape has exactly FOUR equal sides and four equal angles?", opts:["Rectangle","Rhombus","Square","Trapezoid"], ans:"C" },
      { id:"p2m018", q:"If 5 mangoes cost ₦75, how much will 1 mango cost?", opts:["₦10","₦15","₦20","₦25"], ans:"B" },
      { id:"p2m019", q:"What is HALF of 86?", opts:["42","44","43","46"], ans:"C" },
      { id:"p2m020", q:"In 365, what is the sum of all three digits?", opts:["12","14","13","15"], ans:"B" },
      { id:"p2m021", q:"10 × 7 = ?", opts:["17","70","7","700"], ans:"B" },
      { id:"p2m022", q:"A bag weighs 2 kg. How many grams is that?", opts:["20 g","200 g","2000 g","20000 g"], ans:"C" },
      { id:"p2m023", q:"What is 300 + 50 + 9 written as a single number?", opts:["3059","395","359","3509"], ans:"C" },
      { id:"p2m024", q:"36 ÷ 3 = ?", opts:["9","12","10","13"], ans:"B" },
      { id:"p2m025", q:"Which number is between 399 and 402?", opts:["398","403","400","405"], ans:"C" },
      { id:"p2m026", q:"A class has 28 pupils. They sit in groups of 4. How many groups?", opts:["6","7","8","5"], ans:"B" },
      { id:"p2m027", q:"What is the missing number? 5 × ___ = 40", opts:["6","7","8","9"], ans:"C" },
      { id:"p2m028", q:"Which angle is found in a SQUARE corner?", opts:["Acute","Obtuse","Straight","Right"], ans:"D" },
      { id:"p2m029", q:"Chidi had ₦500. He spent ₦175. How much is left?", opts:["₦335","₦315","₦325","₦275"], ans:"C" },
      { id:"p2m030", q:"A clock shows 3:30. The minute hand points to:", opts:["3","6","9","12"], ans:"B" },
      { id:"p2m031", q:"What is 2 × 2 × 2 × 2?", opts:["6","8","16","10"], ans:"C" },
      { id:"p2m032", q:"Which number has 4 hundreds, 0 tens and 7 units?", opts:["470","407","740","704"], ans:"B" },
    ],
    theory: [
      { id:"p2t001", q:"A farmer planted 345 yam seedlings in the first week and 219 in the second week. How many seedlings in total? Show your working.", ans:"564" },
      { id:"p2t002", q:"Explain what ¾ means and shade ¾ of a shape divided into 4 equal parts.", ans:"Three out of four equal parts" },
      { id:"p2t003", q:"Write the multiplication table of 6 from 6×1 to 6×10.", ans:"6,12,18,24,30,36,42,48,54,60" },
      { id:"p2t004", q:"The price of a book is ₦85. Ngozi buys 3 books. How much does she pay? What change does she get from ₦300?", ans:"₦255; change ₦45" },
      { id:"p2t005", q:"List all the factors of 24.", ans:"1, 2, 3, 4, 6, 8, 12, 24" },
      { id:"p2t006", q:"Round 487 to the nearest HUNDRED.", ans:"500" },
      { id:"p2t007", q:"A rectangle is 9 cm long and 5 cm wide. Find its perimeter and area.", ans:"Perimeter = 28 cm; Area = 45 cm²" },
      { id:"p2t008", q:"Divide 56 by 8 and explain what division means.", ans:"7; division means sharing equally" },
      { id:"p2t009", q:"Write these fractions in order from smallest to largest: ½, ¼, ⅓, ¾.", ans:"¼, ⅓, ½, ¾" },
      { id:"p2t010", q:"There are 4 shelves with 12 books each. 15 books are taken out. How many books remain?", ans:"33" },
    ]
  },

  /* ============================================================
     PRIMARY 3
     Topics: Numbers to 1000+, Long Addition/Subtraction,
     Multiplication/Division (×4,×6,×7,×8,×9), Fractions,
     LCM/HCF introduction, Decimals intro, Perimeter & Area, Time
  ============================================================ */
  P3: {
    mcq: [
      { id:"p3m001", q:"What is 746 + 389?", opts:["1125","1135","1145","1115"], ans:"B" },
      { id:"p3m002", q:"Find the HCF of 12 and 18.", opts:["2","3","6","9"], ans:"C" },
      { id:"p3m003", q:"What is 1000 − 437?", opts:["563","573","553","583"], ans:"A" },
      { id:"p3m004", q:"Which of the following is a PRIME number?", opts:["9","15","21","17"], ans:"D" },
      { id:"p3m005", q:"Calculate: 7 × 8 × 2 = ?", opts:["112","98","108","126"], ans:"A" },
      { id:"p3m006", q:"What is the LCM of 4 and 6?", opts:["24","12","6","8"], ans:"B" },
      { id:"p3m007", q:"Simplify the fraction 12/16 to its LOWEST terms.", opts:["3/4","4/3","2/3","6/8"], ans:"A" },
      { id:"p3m008", q:"A rectangle measures 12 cm × 8 cm. What is its AREA?", opts:["40 cm²","96 cm²","20 cm²","80 cm²"], ans:"B" },
      { id:"p3m009", q:"How many minutes are in 2 hours and 35 minutes?", opts:["135","155","165","145"], ans:"B" },
      { id:"p3m010", q:"9 × 9 − 4 × 4 = ?", opts:["61","65","63","67"], ans:"B" },
      { id:"p3m011", q:"Arrange in ASCENDING order: ½, ⅓, ¾, ¼", opts:["¼,⅓,½,¾","⅓,¼,½,¾","¼,½,⅓,¾","½,¾,⅓,¼"], ans:"A" },
      { id:"p3m012", q:"144 ÷ 12 = ?", opts:["10","11","12","13"], ans:"C" },
      { id:"p3m013", q:"A shop sold 256 items on Saturday and 183 on Sunday. How many MORE items on Saturday?", opts:["63","73","83","53"], ans:"B" },
      { id:"p3m014", q:"What is 0.5 as a FRACTION?", opts:["5/10 simplified to 1/2","1/5","5/100","2/5"], ans:"A" },
      { id:"p3m015", q:"In a class of 45 pupils, 3/5 are girls. How many are girls?", opts:["27","25","18","30"], ans:"A" },
      { id:"p3m016", q:"What is the PERIMETER of a square with side 9 cm?", opts:["18 cm","27 cm","36 cm","81 cm"], ans:"C" },
      { id:"p3m017", q:"Which of these numbers is divisible by BOTH 3 and 4?", opts:["22","14","24","18"], ans:"C" },
      { id:"p3m018", q:"Add: ⅔ + ⅓ = ?", opts:["2/6","1","2/3","3/6"], ans:"B" },
      { id:"p3m019", q:"A train departs at 7:45 AM and arrives at 11:15 AM. How long is the journey?", opts:["3 h 15 min","3 h 30 min","3 h 45 min","4 h 15 min"], ans:"B" },
      { id:"p3m020", q:"What value does the digit 8 represent in 3,841?", opts:["8","80","800","8000"], ans:"C" },
      { id:"p3m021", q:"56 × 9 = ?", opts:["494","504","514","484"], ans:"B" },
      { id:"p3m022", q:"What is the REMAINDER when 100 is divided by 7?", opts:["0","1","2","3"], ans:"B" },
      { id:"p3m023", q:"Find the missing number: ___ ÷ 6 = 14 remainder 3", opts:["86","87","84","89"], ans:"B" },
      { id:"p3m024", q:"Which number is both a multiple of 5 AND a multiple of 6?", opts:["25","30","18","20"], ans:"B" },
      { id:"p3m025", q:"A cistern holds 840 litres. If 3/7 is used, how many litres REMAIN?", opts:["480","360","420","540"], ans:"A" },
      { id:"p3m026", q:"Express 0.75 as a fraction in its simplest form.", opts:["75/10","7/5","3/4","7/10"], ans:"C" },
      { id:"p3m027", q:"What is 5² (5 squared)?", opts:["10","15","20","25"], ans:"D" },
      { id:"p3m028", q:"A field is 35 m × 28 m. What is its area in square metres?", opts:["126 m²","980 m²","840 m²","963 m²"], ans:"B" },
      { id:"p3m029", q:"What is 1/3 of 750?", opts:["250","150","225","300"], ans:"A" },
      { id:"p3m030", q:"Find 15% of 200.", opts:["20","25","30","35"], ans:"C" },
      { id:"p3m031", q:"Which of these decimals is GREATEST? 0.4, 0.04, 0.41, 0.401", opts:["0.4","0.04","0.41","0.401"], ans:"C" },
      { id:"p3m032", q:"Subtract: 5/8 − 3/8 = ?", opts:["2/8 = 1/4","3/4","8/8","1/2"], ans:"A" },
    ],
    theory: [
      { id:"p3t001", q:"A school has 1,250 pupils. 3/5 are boys. How many girls are there?", ans:"500" },
      { id:"p3t002", q:"Find the LCM and HCF of 8 and 12. Show all steps.", ans:"LCM = 24; HCF = 4" },
      { id:"p3t003", q:"A trader bought 48 crates of eggs at ₦1,200 each. He sold them for ₦1,450 each. What is his total profit?", ans:"₦12,000" },
      { id:"p3t004", q:"Express these as decimals: ½, ¼, ¾, ⅕", ans:"0.5, 0.25, 0.75, 0.2" },
      { id:"p3t005", q:"A room is 6 m long and 4.5 m wide. Find its perimeter and area.", ans:"Perimeter = 21 m; Area = 27 m²" },
      { id:"p3t006", q:"A clock shows 10:45. What time will it be 3 hours and 40 minutes later?", ans:"2:25" },
      { id:"p3t007", q:"List all prime numbers between 1 and 30.", ans:"2,3,5,7,11,13,17,19,23,29" },
      { id:"p3t008", q:"Adaeze scored 72 out of 90 in a test. Express her score as a percentage.", ans:"80%" },
      { id:"p3t009", q:"Multiply 347 by 12 using long multiplication. Show all steps.", ans:"4164" },
      { id:"p3t010", q:"A tank holds 1,200 litres. It is 5/8 full. How many more litres are needed to fill it?", ans:"450 litres" },
    ]
  },

  /* ============================================================
     PRIMARY 4
     Topics: Numbers to 10,000+, Long Multiplication/Division,
     Fractions (equivalent, mixed numbers), Percentages, Decimals,
     Ratio, Angles, Perimeter/Area/Volume, Averages intro
  ============================================================ */
  P4: {
    mcq: [
      { id:"p4m001", q:"What is 3,458 + 2,976?", opts:["6,334","6,424","6,434","6,324"], ans:"C" },
      { id:"p4m002", q:"Express 3¼ as an improper fraction.", opts:["13/4","12/4","7/4","3/4"], ans:"A" },
      { id:"p4m003", q:"Calculate: 2,340 ÷ 12 = ?", opts:["185","195","165","175"], ans:"B" },
      { id:"p4m004", q:"What is 25% of ₦4,800?", opts:["₦1,000","₦1,200","₦900","₦1,400"], ans:"B" },
      { id:"p4m005", q:"A ratio of boys to girls is 3:5. If there are 40 pupils total, how many boys?", opts:["24","15","16","20"], ans:"B" },
      { id:"p4m006", q:"Find the area of a triangle with base 12 cm and height 9 cm.", opts:["108 cm²","54 cm²","21 cm²","48 cm²"], ans:"B" },
      { id:"p4m007", q:"Which of the following is NOT a prime number?", opts:["29","37","51","43"], ans:"C" },
      { id:"p4m008", q:"Evaluate: 4³ = ?", opts:["12","64","48","16"], ans:"B" },
      { id:"p4m009", q:"What is the AVERAGE of: 18, 24, 30, 12, 36?", opts:["22","24","26","20"], ans:"B" },
      { id:"p4m010", q:"Simplify the ratio 36:48.", opts:["3:4","4:3","6:8","9:12"], ans:"A" },
      { id:"p4m011", q:"A cube has side 4 cm. What is its VOLUME?", opts:["16 cm³","48 cm³","64 cm³","96 cm³"], ans:"C" },
      { id:"p4m012", q:"Convert 450 cm to metres.", opts:["0.45 m","4.5 m","45 m","450 m"], ans:"B" },
      { id:"p4m013", q:"Which fraction is equivalent to 6/9?", opts:["3/4","2/4","2/3","4/6"], ans:"C" },
      { id:"p4m014", q:"3/7 + 2/7 = ?", opts:["5/14","5/7","6/7","1/7"], ans:"B" },
      { id:"p4m015", q:"Kolade bought 15 packets of milk at ₦480 per packet. What is the total cost?", opts:["₦6,800","₦7,200","₦7,000","₦7,500"], ans:"B" },
      { id:"p4m016", q:"What is the square root of 144?", opts:["11","12","13","14"], ans:"B" },
      { id:"p4m017", q:"An angle of 135° is classified as:", opts:["Acute","Right","Obtuse","Reflex"], ans:"C" },
      { id:"p4m018", q:"How many faces does a cuboid have?", opts:["4","8","6","12"], ans:"C" },
      { id:"p4m019", q:"4,000 − 1,847 = ?", opts:["2,163","2,153","2,143","2,173"], ans:"B" },
      { id:"p4m020", q:"If A:B = 2:3 and B = 21, what is A?", opts:["12","14","10","15"], ans:"B" },
      { id:"p4m021", q:"A cylinder has radius 7 cm and height 10 cm. Using π ≈ 22/7, what is its volume?", opts:["1,540 cm³","1,450 cm³","1,340 cm³","1,600 cm³"], ans:"A" },
      { id:"p4m022", q:"Change 4/5 to a decimal.", opts:["0.8","0.45","0.4","0.75"], ans:"A" },
      { id:"p4m023", q:"The sum of angles in any triangle = ?", opts:["90°","180°","270°","360°"], ans:"B" },
      { id:"p4m024", q:"Divide: 7,524 ÷ 4 = ?", opts:["1,881","1,880","1,891","1,860"], ans:"A" },
      { id:"p4m025", q:"Express 0.06 as a percentage.", opts:["0.6%","6%","60%","0.06%"], ans:"B" },
      { id:"p4m026", q:"Subtract: 5⅔ − 2⅓ = ?", opts:["3⅓","3","3½","2⅔"], ans:"A" },
      { id:"p4m027", q:"A shopkeeper sells 240 articles at ₦75 each. What is his total revenue?", opts:["₦16,800","₦18,000","₦17,000","₦19,200"], ans:"B" },
      { id:"p4m028", q:"Which of these is the SMALLEST?  0.3, 0.03, 0.13, 0.031", opts:["0.3","0.13","0.031","0.03"], ans:"C" },
      { id:"p4m029", q:"If 7 workers finish a job in 12 days, how many days will 4 workers take (same rate)?", opts:["18","21","16","24"], ans:"B" },
      { id:"p4m030", q:"A rectangular tank is 80 cm × 50 cm × 40 cm. Find its volume in cm³.", opts:["160,000 cm³","170,000 cm³","80,000 cm³","120,000 cm³"], ans:"A" },
      { id:"p4m031", q:"Which of the following angles sum to 360°? Interior angles of a:", opts:["Triangle","Pentagon","Quadrilateral","Hexagon"], ans:"C" },
      { id:"p4m032", q:"Express 56% as a fraction in its simplest form.", opts:["56/100","14/25","7/12","28/50"], ans:"B" },
    ],
    theory: [
      { id:"p4t001", q:"A trader bought goods for ₦24,500 and sold them for ₦31,200. Calculate the profit and the profit percentage (to 1 decimal place).", ans:"Profit ₦6,700; Profit % = 27.3%" },
      { id:"p4t002", q:"In a class of 60 pupils, the ratio of boys to girls is 7:5. How many boys are there? How many girls?", ans:"Boys = 35; Girls = 25" },
      { id:"p4t003", q:"A circular garden has a diameter of 14 m. Using π = 22/7, find its circumference and area.", ans:"Circumference = 44 m; Area = 154 m²" },
      { id:"p4t004", q:"Find the LCM and HCF of 18, 24 and 36.", ans:"LCM = 72; HCF = 6" },
      { id:"p4t005", q:"Express 3/8 as a decimal and as a percentage.", ans:"0.375 and 37.5%" },
      { id:"p4t006", q:"A train travels 360 km in 4 hours. What is its average speed? How far will it travel in 7 hours?", ans:"90 km/h; 630 km" },
      { id:"p4t007", q:"The angles of a triangle are in the ratio 2:3:4. Find each angle.", ans:"40°, 60°, 80°" },
      { id:"p4t008", q:"Calculate: 456 × 78 using long multiplication.", ans:"35,568" },
      { id:"p4t009", q:"A container holds 3.5 litres. How many 250 ml cups can be filled from it?", ans:"14 cups" },
      { id:"p4t010", q:"Find the average of 45, 67, 89, 23, 76.", ans:"60" },
    ]
  },

  /* ============================================================
     PRIMARY 5
     Topics: Whole Numbers (millions+), Roman Numerals,
     Multiplication/Division (5+ digit), Prime Numbers, Fractions,
     Ratios, Percentages, Algebraic Processes, Square/Square Root,
     Estimation, Statistics (mean, mode, median, range, bar charts)
  ============================================================ */
  P5: {
    mcq: [
      { id:"p5m001", q:"What is 2,456,000 + 3,874,000?", opts:["6,230,000","6,330,000","6,320,000","6,340,000"], ans:"B" },
      { id:"p5m002", q:"Write MMCDXLVII in Hindu-Arabic numerals.", opts:["2427","2447","2547","2647"], ans:"B" },
      { id:"p5m003", q:"What is the square root of 625?", opts:["20","25","30","35"], ans:"B" },
      { id:"p5m004", q:"Solve for x: 3x + 7 = 28", opts:["5","6","7","8"], ans:"C" },
      { id:"p5m005", q:"Express 3/8 ÷ 9/16 in simplest form.", opts:["2/3","3/4","1/2","4/3"], ans:"A" },
      { id:"p5m006", q:"The mean of 5 numbers is 24. If four of them are 18, 26, 30, 22, what is the fifth?", opts:["22","24","24","26"], ans:"C" },
      { id:"p5m007", q:"A car depreciates 15% per year. If it cost ₦2,400,000, what is its value after ONE year?", opts:["₦1,920,000","₦2,040,000","₦2,160,000","₦2,100,000"], ans:"B" },
      { id:"p5m008", q:"Which of these is a COMPOSITE number?", opts:["2","11","37","49"], ans:"D" },
      { id:"p5m009", q:"Find 2/3 of 3/4 of 480.", opts:["240","200","220","260"], ans:"A" },
      { id:"p5m010", q:"Find the MEDIAN of: 5, 12, 7, 3, 9, 15, 11", opts:["9","7","11","5"], ans:"A" },
      { id:"p5m011", q:"If 12 pipes take 8 hours to fill a pool, how long will 16 pipes take?", opts:["6 hours","5 hours","4 hours","10 hours"], ans:"A" },
      { id:"p5m012", q:"Simplify: 5a + 3b − 2a + 7b = ?", opts:["3a + 10b","7a + 4b","3a − 10b","10a + 3b"], ans:"A" },
      { id:"p5m013", q:"What is 12² + 5² ?", opts:["139","169","219","144"], ans:"B" },
      { id:"p5m014", q:"A sum of money is shared between Amaka and Bola in the ratio 5:7. Bola gets ₦14,000. Find the total sum.", opts:["₦24,000","₦30,000","₦22,000","₦28,000"], ans:"A" },
      { id:"p5m015", q:"The MODE of: 4, 7, 4, 9, 4, 7, 3, 7, 4 is:", opts:["3","7","9","4"], ans:"D" },
      { id:"p5m016", q:"Factorise: 6x + 9y", opts:["3(2x + 3y)","6(x + y)","3(3x + 2y)","9(x + y)"], ans:"A" },
      { id:"p5m017", q:"Estimate 4,987 × 503 to the nearest thousands.", opts:["2,500,000","2,000,000","2,500,000","3,000,000"], ans:"A" },
      { id:"p5m018", q:"The RANGE of: 14, 22, 8, 31, 17, 5 is:", opts:["22","26","27","17"], ans:"B" },
      { id:"p5m019", q:"Solve: 2(3x − 4) = 16", opts:["x = 4","x = 3","x = 5","x = 6"], ans:"A" },
      { id:"p5m020", q:"A principal of ₦50,000 earns simple interest at 8% per annum. What is the interest after 3 years?", opts:["₦10,000","₦12,000","₦8,000","₦15,000"], ans:"B" },
      { id:"p5m021", q:"Multiply: 34,256 × 27 = ?", opts:["924,912","946,912","925,912","934,912"], ans:"A" },
      { id:"p5m022", q:"What is the cube of 4 (4³)?", opts:["12","24","48","64"], ans:"D" },
      { id:"p5m023", q:"Convert 5/8 to a percentage.", opts:["58%","62.5%","52%","56.25%"], ans:"B" },
      { id:"p5m024", q:"If x = 3 and y = 4, evaluate 2x² + 3y − x", opts:["27","29","31","21"], ans:"B" },
      { id:"p5m025", q:"In Roman numerals, what is MMDCCXLVIII?", opts:["2748","2648","2758","2848"], ans:"A" },
      { id:"p5m026", q:"Find the HCF and LCM of 48 and 72.", opts:["HCF=24, LCM=144","HCF=12, LCM=288","HCF=24, LCM=288","HCF=6, LCM=144"], ans:"A" },
      { id:"p5m027", q:"A bike travels at 45 km/h. How far does it travel in 2 hours 40 minutes?", opts:["100 km","110 km","115 km","120 km"], ans:"D" },
      { id:"p5m028", q:"The sum of interior angles of a PENTAGON is:", opts:["360°","540°","720°","480°"], ans:"B" },
      { id:"p5m029", q:"Express 2⅝ as a decimal.", opts:["2.625","2.58","2.68","2.375"], ans:"A" },
      { id:"p5m030", q:"A worker earns ₦180,000 per year. He pays 10% income tax. What is his monthly NET pay?", opts:["₦13,500","₦15,000","₦12,500","₦16,000"], ans:"A" },
      { id:"p5m031", q:"What is √(196) × √(64)?", opts:["108","114","112","118"], ans:"C" },
      { id:"p5m032", q:"A cylindrical tank has radius 3.5 m and height 8 m. Using π = 22/7, find the volume.", opts:["308 m³","280 m³","320 m³","264 m³"], ans:"A" },
    ],
    theory: [
      { id:"p5t001", q:"The ages of 6 students are: 11, 13, 12, 14, 11, 13. Find the mean, median, mode and range.", ans:"Mean=12.33; Median=12.5; Mode=11 and 13; Range=3" },
      { id:"p5t002", q:"A rectangular swimming pool is 25 m × 12 m × 1.5 m deep. Find its volume in m³ and capacity in litres.", ans:"Volume = 450 m³; Capacity = 450,000 litres" },
      { id:"p5t003", q:"Solve the simultaneous equations: x + y = 15 and x − y = 5.", ans:"x=10, y=5" },
      { id:"p5t004", q:"A man invests ₦120,000 at 12% simple interest per annum. After how many years will his total amount be ₦163,200?", ans:"3 years" },
      { id:"p5t005", q:"The prime factorisation of a number is 2³ × 3² × 5. What is the number? Is it a perfect square?", ans:"360; not a perfect square" },
      { id:"p5t006", q:"Convert MMDCCCXCIX to Hindu-Arabic. Then convert 3,456 to Roman numerals.", ans:"2899; MMMCDLVI" },
      { id:"p5t007", q:"Factorise completely: 12a²b − 8ab²", ans:"4ab(3a − 2b)" },
      { id:"p5t008", q:"A train 120 m long passes a stationary train 180 m long. If the speed is 54 km/h, how long does it take to completely pass?", ans:"20 seconds" },
      { id:"p5t009", q:"Express 0.000325 in standard form.", ans:"3.25 × 10⁻⁴" },
      { id:"p5t010", q:"In a pie chart, if 90 pupils out of 360 prefer Mathematics, what angle represents Mathematics on the pie chart?", ans:"90°" },
    ]
  }
};

/** Flat lookup by id */
window.QUESTION_MAP = {};
for (const cls of Object.keys(window.QUESTIONS)) {
  for (const q of window.QUESTIONS[cls].mcq)    window.QUESTION_MAP[q.id] = q;
  for (const q of window.QUESTIONS[cls].theory) window.QUESTION_MAP[q.id] = q;
}
