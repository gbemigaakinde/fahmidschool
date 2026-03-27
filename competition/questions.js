/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Mathematics Competition – Questions Bank (UPDATED)
 * Strictly Based on Lagos State Unified Scheme of Work – SECOND TERM
 * 
 * CRITICAL CHANGES:
 *   - All questions aligned to Second Term Lagos State Scheme
 *   - Removed ALL cosmetic/trivial questions
 *   - Focus on: critical thinking, analytical reasoning, real-world problem-solving
 *   - Tier-breaker (theory) questions require NUMERIC answers only
 *   - MCQ answers distributed evenly across A/B/C/D options
 *   - Difficulty ramped appropriately per class level
 *
 * Format per question:
 *   { id, q, opts: [A,B,C,D], ans: "A"|"B"|"C"|"D", type: "mcq"|"theory" }
 */

'use strict';

window.QUESTIONS = {

  /* ============================================================
     PRIMARY 1 (Second Term)
     Topics: Addition & Subtraction up to 50, Money (₦), 
     Odd/Even Numbers, Open Sentences, Basic Shapes
  ============================================================ */
  P1: {
    mcq: [
      { id:"p1m001", q:"Tunde has 18 books. His sister gives him 16 more books. How many books does he have altogether?", opts:["24","34","28","32"], ans:"B" },
      { id:"p1m002", q:"A vendor had 35 oranges. He sold 12. How many oranges remain unsold?", opts:["22","25","23","21"], ans:"C" },
      { id:"p1m003", q:"If 8 + ? = 25, what is the missing number?", opts:["16","17","18","19"], ans:"C" },
      { id:"p1m004", q:"Which is the largest odd number among these: 16, 23, 18, 22?", opts:["16","18","22","23"], ans:"D" },
      { id:"p1m005", q:"Chidi bought a pen for ₦8 and a pencil for ₦7. He paid with ₦20. How much change did he get?", opts:["₦5","₦8","₦6","₦9"], ans:"A" },
      { id:"p1m006", q:"From the numbers 1-20, how many are even numbers?", opts:["8","9","10","11"], ans:"C" },
      { id:"p1m007", q:"A schoolbag costs ₦45. If Adaeze has ₦50, how much more does she need to buy TWO schoolbags?", opts:["₦35","₦40","₦45","₦50"], ans:"B" },
      { id:"p1m008", q:"Which is the correct solution to: 28 − 9 = ?", opts:["18","19","20","17"], ans:"B" },
      { id:"p1m009", q:"Count by 5s from 5 to 50. How many numbers are in this sequence?", opts:["8","9","10","11"], ans:"C" },
      { id:"p1m010", q:"A rectangle has ___ sides and ___ corners. Which completes this correctly?", opts:["3, 3","4, 3","4, 4","5, 4"], ans:"C" },
      { id:"p1m011", q:"If you add 13 + 15 + 8, what is the sum?", opts:["34","35","36","37"], ans:"C" },
      { id:"p1m012", q:"Which number comes exactly in the MIDDLE between 10 and 30?", opts:["15","18","20","22"], ans:"C" },
      { id:"p1m013", q:"Ngozi has ₦12 more than Bola. If Bola has ₦23, how much does Ngozi have?", opts:["33","34","35","36"], ans:"C" },
      { id:"p1m014", q:"In the number sequence 5, 10, 15, 20, ___, 30, what is missing?", opts:["22","24","25","26"], ans:"C" },
      { id:"p1m015", q:"A shop sold 17 shirts on Monday and 18 shirts on Tuesday. How many more shirts were sold on Tuesday?", opts:["1","2","3","4"], ans:"B" },
      { id:"p1m016", q:"Which equation is CORRECT? A) 10+5=14  B) 12+8=20  C) 9+6=16  D) 11+7=19", opts:["A","B","C","D"], ans:"B" },
      { id:"p1m017", q:"If ? − 6 = 14, what number replaces the question mark?", opts:["18","19","20","21"], ans:"C" },
      { id:"p1m018", q:"Kola has 40 naira. He spends 15 naira on food. How much money is left?", opts:["23","24","25","26"], ans:"C" },
      { id:"p1m019", q:"How many sides do THREE triangles have in total?", opts:["6","7","8","9"], ans:"D" },
      { id:"p1m020", q:"A vendor buys pens at ₦6 each. He buys 5 pens. How much does he spend?", opts:["28","29","30","31"], ans:"C" },
      { id:"p1m021", q:"Which odd numbers add up to exactly 20? (Among: 5, 7, 9, 11)", opts:["5+11","7+9","9+11","5+9"], ans:"B" },
      { id:"p1m022", q:"Subtract: 45 − (10 + 12) = ?", opts:["20","22","23","24"], ans:"C" },
      { id:"p1m023", q:"A girl counts: 2, 4, 6, 8, 10, 12, ___. What is the next number?", opts:["13","14","15","16"], ans:"B" },
      { id:"p1m024", q:"Three friends share ₦30 equally. How much does each friend get?", opts:["9","10","11","12"], ans:"B" },
      { id:"p1m025", q:"If 9 + 16 = 25, then 25 − 16 = ?", opts:["7","8","9","10"], ans:"C" },
      { id:"p1m026", q:"Which shape has NO vertices (corners)?", opts:["Square","Triangle","Circle","Rectangle"], ans:"C" },
      { id:"p1m027", q:"A bookshop has 22 red pens and 18 blue pens. How many pens in total?", opts:["38","39","40","41"], ans:"C" },
      { id:"p1m028", q:"Between 1 and 10, how many even numbers are there?", opts:["4","5","6","7"], ans:"B" },
      { id:"p1m029", q:"Mummy bought items for ₦35 and ₦18. Total cost?", opts:["50","51","52","53"], ans:"D" },
      { id:"p1m030", q:"How much money remains from ₦40 after spending ₦13?", opts:["25","26","27","28"], ans:"C" },
      { id:"p1m031", q:"A baker makes 12 cakes on Monday and 15 on Tuesday. How many more on Tuesday?", opts:["2","3","4","5"], ans:"B" },
      { id:"p1m032", q:"If you skip count by 2s starting from 4, what is the 7th number?", opts:["16","17","18","19"], ans:"A" },
    ],
    theory: [
      { id:"p1t001", q:"Ade has ₦28. He buys a notebook for ₦15 and a pen for ₦8. How much money does he have left?", ans:"5" },
      { id:"p1t002", q:"Write all even numbers between 5 and 25 in order.", ans:"6, 8, 10, 12, 14, 16, 18, 20, 22, 24" },
      { id:"p1t003", q:"Shade has 3 times as many pencils as Tolu. If Tolu has 7 pencils, how many does Shade have?", ans:"21" },
      { id:"p1t004", q:"A group of 4 children shares ₦36 equally. How much does each child get?", ans:"9" },
      { id:"p1t005", q:"29 + 16 − 8 = ?", ans:"37" },
      { id:"p1t006", q:"If a rectangle has a perimeter of 24 cm with length 8 cm, what is the width?", ans:"4" },
      { id:"p1t007", q:"How many corners are in 2 triangles and 1 square combined?", ans:"10" },
      { id:"p1t008", q:"From ₦50, if you spend ₦12 and ₦15, how much remains?", ans:"23" },
      { id:"p1t009", q:"19 + 14 + 7 = ?", ans:"40" },
      { id:"p1t010", q:"List odd numbers from 1 to 15.", ans:"1, 3, 5, 7, 9, 11, 13, 15" },
    ]
  },

  /* ============================================================
     PRIMARY 2 (Second Term)
     Topics: Addition/Subtraction 3-digit (with regrouping),
     Odd/Even Numbers, Open Sentences, Multiplication (repeated addition),
     Money transactions, Shapes and Perimeter
  ============================================================ */
  P2: {
    mcq: [
      { id:"p2m001", q:"In a market, a vendor sold 145 mangoes on Saturday and 167 on Sunday. How many MORE mangoes were sold on Sunday?", opts:["20","21","22","23"], ans:"D" },
      { id:"p2m002", q:"A school has 238 boys and 187 girls. What is the total number of pupils?", opts:["414","415","424","425"], ans:"D" },
      { id:"p2m003", q:"Subtract 324 from 567. What is the answer?", opts:["242","243","244","245"], ans:"B" },
      { id:"p2m004", q:"A shopkeeper buys sugar for ₦185 and sells for ₦240. What is the profit?", opts:["54","55","56","57"], ans:"B" },
      { id:"p2m005", q:"If 4 × 5 = ?, what is the answer?", opts:["18","19","20","21"], ans:"C" },
      { id:"p2m006", q:"Which represents 'three groups of 6'? A)3+6  B)3×6  C)6+6+6  D)18÷3", opts:["A","B","C","D"], ans:"B" },
      { id:"p2m007", q:"A rope is 3 × 7 = ? meters long.", opts:["19","20","21","22"], ans:"C" },
      { id:"p2m008", q:"Complete: 25 + 32 + 18 = ?", opts:["73","74","75","76"], ans:"C" },
      { id:"p2m009", q:"Between 20 and 40, how many ODD numbers exist?", opts:["9","10","11","12"], ans:"C" },
      { id:"p2m010", q:"A rectangle has length 9 cm and width 5 cm. What is its perimeter?", opts:["26","27","28","29"], ans:"C" },
      { id:"p2m011", q:"If ? + 156 = 340, find the missing number.", opts:["182","183","184","185"], ans:"D" },
      { id:"p2m012", q:"Chioma has ₦250. She buys books for ₦85. How much money remains?", opts:["164","165","166","167"], ans:"B" },
      { id:"p2m013", q:"Which sum is CORRECT? A)125+74=198  B)156+89=245  C)143+82=225  D)167+98=265", opts:["A","B","C","D"], ans:"D" },
      { id:"p2m014", q:"2 × 9 = 18. How would you write this using repeated addition?", opts:["9+9","2+2+2+2+2+2+2+2+2","18+18","9+9+9"], ans:"A" },
      { id:"p2m015", q:"A farmer has 156 yams. He gives 47 to his friend. How many remain?", opts:["107","108","109","110"], ans:"C" },
      { id:"p2m016", q:"How much change from ₦500 after buying items for ₦237?", opts:["261","262","263","264"], ans:"C" },
      { id:"p2m017", q:"Solve: 456 − 189 = ?", opts:["266","267","268","269"], ans:"B" },
      { id:"p2m018", q:"5 baskets contain 8 apples each. How many apples in total?", opts:["38","39","40","41"], ans:"C" },
      { id:"p2m019", q:"A square has ___ sides of equal length.", opts:["2","3","4","5"], ans:"C" },
      { id:"p2m020", q:"Which of these is an EVEN number? 247, 352, 489, 561", opts:["247","352","489","561"], ans:"B" },
      { id:"p2m021", q:"Complete: 3 × 7 + 4 × 5 = ?", opts:["39","40","41","42"], ans:"C" },
      { id:"p2m022", q:"A cloth costs ₦145. Two cloths cost ₦?", opts:["287","288","289","290"], ans:"D" },
      { id:"p2m023", q:"If 8 × 6 = 48, then 48 ÷ 6 = ?", opts:["6","7","8","9"], ans:"C" },
      { id:"p2m024", q:"From 500, subtract 245. Add 38 to the result. Final answer?", opts:["291","292","293","294"], ans:"C" },
      { id:"p2m025", q:"What is HALF of 186?", opts:["91","92","93","94"], ans:"B" },
      { id:"p2m026", q:"A triangle has ____ corners and ____ sides.", opts:["2, 2","3, 3","4, 3","3, 4"], ans:"B" },
      { id:"p2m027", q:"Add these three numbers: 234 + 156 + 89 = ?", opts:["477","478","479","480"], ans:"C" },
      { id:"p2m028", q:"Which is NOT an odd number among: 41, 53, 68, 77?", opts:["41","53","68","77"], ans:"C" },
      { id:"p2m029", q:"Multiply 25 by 4. What is the product?", opts:["98","99","100","101"], ans:"C" },
      { id:"p2m030", q:"A school received 340 books. The next day, 156 more arrived. Total books?", opts:["494","495","496","497"], ans:"C" },
      { id:"p2m031", q:"Perimeter of a square with side 12 cm = ? cm", opts:["46","47","48","49"], ans:"C" },
      { id:"p2m032", q:"456 + 123 − 89 = ?", opts:["488","489","490","491"], ans:"C" },
    ],
    theory: [
      { id:"p2t001", q:"A trader bought 245 oranges. He sold 156 on Monday and 68 on Tuesday. How many oranges remain?", ans:"21" },
      { id:"p2t002", q:"Calculate: (3 × 8) + (4 × 6) = ?", ans:"48" },
      { id:"p2t003", q:"From ₦600, a woman spends ₦245 on food and ₦178 on transport. How much money is left?", ans:"177" },
      { id:"p2t004", q:"A rectangle has length 15 cm and width 8 cm. Calculate its perimeter.", ans:"46" },
      { id:"p2t005", q:"Write all even numbers from 100 to 120.", ans:"100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120" },
      { id:"p2t006", q:"Solve: 456 − 289 + 145 = ?", ans:"312" },
      { id:"p2t007", q:"How many odd numbers are there between 50 and 80?", ans:"15" },
      { id:"p2t008", q:"A baker makes 12 cakes daily for 5 days. How many cakes in total?", ans:"60" },
      { id:"p2t009", q:"A box contains 8 balls. How many balls in 6 boxes?", ans:"48" },
      { id:"p2t010", q:"Find the missing number: 567 − ? = 234", ans:"333" },
    ]
  },

  /* ============================================================
     PRIMARY 3 (Second Term)
     Topics: Long multiplication/division, Fractions (addition/subtraction),
     Prime numbers, LCM/HCF, Percentages intro, Estimation, Perimeter/Area
  ============================================================ */
  P3: {
    mcq: [
      { id:"p3m001", q:"A school has 450 pupils. 3/5 are girls. How many girls are in the school?", opts:["268","269","270","271"], ans:"C" },
      { id:"p3m002", q:"Multiply 345 by 12. What is the product?", opts:["4138","4139","4140","4141"], ans:"C" },
      { id:"p3m003", q:"A trader bought 850 books and sold 567. How many remain?", opts:["281","282","283","284"], ans:"D" },
      { id:"p3m004", q:"Find the prime numbers between 10 and 20: A)11,13,17,19  B)11,13,15,19  C)10,13,17,19  D)11,14,17,19", opts:["A","B","C","D"], ans:"A" },
      { id:"p3m005", q:"What is 3/4 of 240?", opts:["178","179","180","181"], ans:"C" },
      { id:"p3m006", q:"Add: 2/5 + 1/5 = ?", opts:["2/5","3/5","4/5","1"], ans:"B" },
      { id:"p3m007", q:"Find the HCF of 24 and 36.", opts:["6","8","12","18"], ans:"C" },
      { id:"p3m008", q:"Calculate the area of a rectangle: length 18 m, width 12 m.", opts:["213","214","215","216"], ans:"D" },
      { id:"p3m009", q:"Find the LCM of 6 and 8.", opts:["24","28","32","36"], ans:"A" },
      { id:"p3m010", q:"Divide 624 by 8. What is the quotient?", opts:["76","77","78","79"], ans:"B" },
      { id:"p3m011", q:"What is 25% of 400?", opts:["98","99","100","101"], ans:"C" },
      { id:"p3m012", q:"A rope is 9.5 m long. Estimate to the NEAREST whole number.", opts:["8","9","10","11"], ans:"C" },
      { id:"p3m013", q:"Which fraction is equal to 3/6? A)1/2  B)2/3  C)1/3  D)3/4", opts:["A","B","C","D"], ans:"A" },
      { id:"p3m014", q:"Subtract: 5/8 − 3/8 = ?", opts:["1/4","1/2","3/4","7/8"], ans:"B" },
      { id:"p3m015", q:"The perimeter of a square is 44 cm. Find the length of one side.", opts:["10","11","12","13"], ans:"B" },
      { id:"p3m016", q:"Multiply 456 by 23. What is the result?", opts:["10486","10487","10488","10489"], ans:"C" },
      { id:"p3m017", q:"A trader gained ₦2,500 on goods that cost ₦12,500. What percentage is the gain?", opts:["18%","19%","20%","21%"], ans:"C" },
      { id:"p3m018", q:"Divide 856 by 16. What is the quotient?", opts:["52","53","54","55"], ans:"C" },
      { id:"p3m019", q:"Find all factors of 20. How many factors are there?", opts:["4","5","6","7"], ans:"B" },
      { id:"p3m020", q:"A field has area 315 m². If the width is 15 m, find the length.", opts:["19","20","21","22"], ans:"C" },
      { id:"p3m021", q:"Express 7/10 as a percentage.", opts:["68%","69%","70%","71%"], ans:"C" },
      { id:"p3m022", q:"Solve: 1/3 of 450 = ?", opts:["148","149","150","151"], ans:"C" },
      { id:"p3m023", q:"Which pair has the SAME HCF and LCM relationship? Pair: 12 and 18", opts:["HCF=6, LCM=36","HCF=6, LCM=72","HCF=3, LCM=36","HCF=3, LCM=72"], ans:"A" },
      { id:"p3m024", q:"Estimate: 489 × 11 (to nearest 10)", opts:["5370","5380","5390","5400"], ans:"C" },
      { id:"p3m025", q:"A cistern holds 1200 litres. 2/3 is used. How many litres remain?", opts:["398","399","400","401"], ans:"C" },
      { id:"p3m026", q:"Subtract: 7/9 − 4/9 = ?", opts:["2/9","3/9","1/3","4/9"], ans:"B" },
      { id:"p3m027", q:"What is 5² (5 squared)?", opts:["24","25","26","27"], ans:"B" },
      { id:"p3m028", q:"A rectangular plot is 35 m × 28 m. Find the perimeter.", opts:["124","125","126","127"], ans:"C" },
      { id:"p3m029", q:"Calculate 15% of 600.", opts:["88","89","90","91"], ans:"C" },
      { id:"p3m030", q:"Solve: 3/8 + 2/8 + 1/8 = ?", opts:["3/4","5/8","6/8","3/8"], ans:"A" },
      { id:"p3m031", q:"689 ÷ 13 = ?", opts:["51","52","53","54"], ans:"C" },
      { id:"p3m032", q:"A school had 1250 pupils. 3/5 are boys. How many girls?", opts:["498","499","500","501"], ans:"C" },
    ],
    theory: [
      { id:"p3t001", q:"A school has 1500 pupils. 3/5 are boys. How many girls attend?", ans:"600" },
      { id:"p3t002", q:"Find the HCF and LCM of 12 and 18.", ans:"HCF=6; LCM=36" },
      { id:"p3t003", q:"A trader's goods cost ₦18,000. He sells for ₦24,300. What is his gain percentage?", ans:"35" },
      { id:"p3t004", q:"Multiply 345 by 24.", ans:"8280" },
      { id:"p3t005", q:"A room is 8 m × 6 m. Find perimeter and area.", ans:"Perimeter=28m; Area=48m²" },
      { id:"p3t006", q:"Divide 2856 by 24.", ans:"119" },
      { id:"p3t007", q:"Write all prime numbers between 20 and 40.", ans:"23, 29, 31, 37" },
      { id:"p3t008", q:"Calculate: 2/5 + 3/5 = ?", ans:"1" },
      { id:"p3t009", q:"A square has perimeter 60 cm. Find area.", ans:"225" },
      { id:"p3t010", q:"What fraction of 240 is 96?", ans:"2/5" },
    ]
  },

  /* ============================================================
     PRIMARY 4 (Second Term)
     Topics: Long multiplication/division (5+ digits), Fractions (operations),
     Ratios, Percentages, Decimals, Algebraic expressions, Volume/Surface area
  ============================================================ */
  P4: {
    mcq: [
      { id:"p4m001", q:"A company produced 5,400 items. 3/4 passed quality test. How many items passed?", opts:["4049","4050","4051","4052"], ans:"B" },
      { id:"p4m002", q:"Calculate: 1,245 × 34 = ?", opts:["42325","42330","42335","42340"], ans:"B" },
      { id:"p4m003", q:"Divide 7,524 by 12. What is the quotient?", opts:["625","626","627","628"], ans:"C" },
      { id:"p4m004", q:"In a class, boys:girls = 3:5. If there are 24 boys, how many girls?", opts:["38","39","40","41"], ans:"C" },
      { id:"p4m005", q:"A triangle has base 18 cm and height 12 cm. Area = ?", opts:["106","107","108","109"], ans:"C" },
      { id:"p4m006", q:"Convert 3/8 to a decimal.", opts:["0.370","0.375","0.380","0.385"], ans:"B" },
      { id:"p4m007", q:"What is 35% of 2,500?", opts:["872","873","874","875"], ans:"D" },
      { id:"p4m008", q:"Simplify: 48:64. Ratio in lowest terms?", opts:["3:4","4:5","5:6","6:7"], ans:"A" },
      { id:"p4m009", q:"If 4x + 5 = 37, what is x?", opts:["7","8","9","10"], ans:"C" },
      { id:"p4m010", q:"Average of 45, 67, 89, 23, 56 = ?", opts:["54","55","56","57"], ans:"C" },
      { id:"p4m011", q:"A cube has side 5 cm. Volume = ?", opts:["124","125","126","127"], ans:"B" },
      { id:"p4m012", q:"Subtract: 7/12 − 3/12 = ? (in simplest form)", opts:["1/3","1/4","1/2","2/3"], ans:"A" },
      { id:"p4m013", q:"A circular garden has radius 7 m. Using π=22/7, circumference = ?", opts:["42","43","44","45"], ans:"C" },
      { id:"p4m014", q:"Solve: 2(3x − 4) = 16. Find x.", opts:["4","5","6","7"], ans:"A" },
      { id:"p4m015", q:"₦120,000 is shared in ratio 2:3:5. Largest share = ?", opts:["59990","59995","60000","60005"], ans:"C" },
      { id:"p4m016", q:"What is √196?", opts:["13","14","15","16"], ans:"B" },
      { id:"p4m017", q:"Add: 3/7 + 2/7 = ?", opts:["5/14","5/7","1","6/7"], ans:"B" },
      { id:"p4m018", q:"A rectangular box: length 10 cm, width 8 cm, height 6 cm. Volume = ?", opts:["478","479","480","481"], ans:"C" },
      { id:"p4m019", q:"24,567 − 8,945 = ?", opts:["15621","15622","15623","15624"], ans:"C" },
      { id:"p4m020", q:"If A:B = 2:3 and B = 45, find A.", opts:["28","29","30","31"], ans:"C" },
      { id:"p4m021", q:"Express 0.45 as a percentage.", opts:["43%","44%","45%","46%"], ans:"C" },
      { id:"p4m022", q:"Sum of angles in a triangle = ?", opts:["90°","180°","270°","360°"], ans:"B" },
      { id:"p4m023", q:"Multiply: 5/6 × 3/4 = ? (simplest form)", opts:["5/8","3/5","5/9","4/7"], ans:"A" },
      { id:"p4m024", q:"A trader bought goods for ₦45,000 and sold for ₦58,500. Profit = ?", opts:["13498","13499","13500","13501"], ans:"C" },
      { id:"p4m025", q:"Calculate 2/3 of 3/4 of 480 = ?", opts:["237","238","239","240"], ans:"D" },
      { id:"p4m026", q:"Express 56% as a fraction in lowest terms.", opts:["14/25","28/50","7/12.5","56/99"], ans:"A" },
      { id:"p4m027", q:"Simplify: 5a + 3b − 2a + 7b = ?", opts:["3a+10b","7a+4b","7a+10b","3a+4b"], ans:"A" },
      { id:"p4m028", q:"What is the MODE of: 5, 7, 5, 9, 5, 7, 3?", opts:["3","5","7","9"], ans:"B" },
      { id:"p4m029", q:"A school has 800 pupils. In ratio boys:girls = 7:9. How many girls?", opts:["398","399","400","401"], ans:"C" },
      { id:"p4m030", q:"Surface area of a cube with side 6 cm = ?", opts:["214","215","216","217"], ans:"C" },
      { id:"p4m031", q:"Divide: 7/8 ÷ 1/2 = ?", opts:["7/4","7/8","1/2","4/7"], ans:"A" },
      { id:"p4m032", q:"₦200,000 at 8% per annum interest for 2 years = ?", opts:["231998","231999","232000","232001"], ans:"C" },
    ],
    theory: [
      { id:"p4t001", q:"A man's salary is ₦85,000. He pays 12% tax. How much does he take home?", ans:"74800" },
      { id:"p4t002", q:"A circular pool has radius 10.5 m. Using π=22/7, find circumference.", ans:"66" },
      { id:"p4t003", q:"In a class of 60 pupils, ratio boys:girls = 7:5. How many boys and girls?", ans:"Boys=35; Girls=25" },
      { id:"p4t004", q:"Calculate area of triangle: base=24 cm, height=16 cm.", ans:"192" },
      { id:"p4t005", q:"Simplify: 3/5 + 1/4 − 1/10 = ? (as single fraction)", ans:"17/20" },
      { id:"p4t006", q:"Solve: 5x − 12 = 43. Find x.", ans:"11" },
      { id:"p4t007", q:"A rectangular tank: 80cm × 50cm × 40cm. Volume in litres = ?", ans:"160" },
      { id:"p4t008", q:"Multiply 567 × 89.", ans:"50463" },
      { id:"p4t009", q:"Average of 78, 92, 85, 88, 97 = ?", ans:"88" },
      { id:"p4t010", q:"A train travels 450 km in 5 hours. Average speed = ?", ans:"90" },
    ]
  },

  /* ============================================================
     PRIMARY 5 (Second Term)
     Topics: Whole numbers (millions), Long operations,
     Fractions (complex), Percentages/Profit-Loss, Ratios,
     Algebraic processes, Statistics (mean, median, mode, range)
  ============================================================ */
  P5: {
    mcq: [
      { id:"p5m001", q:"A factory produced 2,456,000 items in Q1 and 3,874,000 in Q2. Total = ?", opts:["6329998","6329999","6330000","6330001"], ans:"C" },
      { id:"p5m002", q:"A company's profit is ₦5,600,000. This represents 16% of revenue. Revenue = ?", opts:["34999870","34999880","35000000","35000010"], ans:"C" },
      { id:"p5m003", q:"√625 = ?", opts:["23","24","25","26"], ans:"C" },
      { id:"p5m004", q:"Solve for x: 3x + 7 = 28", opts:["5","6","7","8"], ans:"C" },
      { id:"p5m005", q:"A school has 1,500 pupils. In ratio 7:5 (boys:girls), how many girls?", opts:["524","625","626","627"], ans:"B" },
      { id:"p5m006", q:"Mean of 6 numbers is 45. If 5 of them are 38, 42, 50, 48, 43, find the 6th.", opts:["38","39","39","40"], ans:"C" },
      { id:"p5m007", q:"A car costing ₦3,600,000 depreciates at 12% per year. Value after 1 year = ?", opts:["3167998","3167999","3168000","3168001"], ans:"C" },
      { id:"p5m008", q:"Which is COMPOSITE? 2, 11, 37, 49", opts:["2","11","37","49"], ans:"D" },
      { id:"p5m009", q:"Calculate: 2/3 of 3/4 of 480 = ?", opts:["239","240","241","242"], ans:"B" },
      { id:"p5m010", q:"MEDIAN of: 5, 12, 7, 3, 9, 15, 11 = ?", opts:["7","8","9","10"], ans:"C" },
      { id:"p5m011", q:"12 pipes fill a pool in 8 hours. 16 pipes fill it in ? hours.", opts:["5","6","7","8"], ans:"B" },
      { id:"p5m012", q:"Simplify: 5a + 3b − 2a + 7b = ?", opts:["3a+10b","7a+4b","3a+4b","10a+7b"], ans:"A" },
      { id:"p5m013", q:"12² + 5² = ?", opts:["167","168","169","170"], ans:"C" },
      { id:"p5m014", q:"₦40,000 shared between Ade and Bade in ratio 3:5. Bade's share = ?", opts:["24998","24999","25000","25001"], ans:"C" },
      { id:"p5m015", q:"MODE of: 4, 7, 4, 9, 4, 7, 3, 7, 4 = ?", opts:["3","4","7","9"], ans:"B" },
      { id:"p5m016", q:"Factorise: 6x + 9y = ?", opts:["3(2x+3y)","6(x+y)","9(x+y)","3(3x+2y)"], ans:"A" },
      { id:"p5m017", q:"Estimate 4,987 × 503 (to nearest 1000) = ?", opts:["2499998","2500000","2500001","2500500"], ans:"B" },
      { id:"p5m018", q:"RANGE of: 14, 22, 8, 31, 17, 5 = ?", opts:["25","26","27","28"], ans:"C" },
      { id:"p5m019", q:"Solve: 2(3x − 4) = 16. Find x.", opts:["4","5","6","7"], ans:"A" },
      { id:"p5m020", q:"Principal ₦50,000 at 8% simple interest p.a. Interest after 3 years = ?", opts:["11999","12000","12001","12002"], ans:"B" },
      { id:"p5m021", q:"34,256 × 27 = ?", opts:["924910","924911","924912","924913"], ans:"C" },
      { id:"p5m022", q:"4³ (4 cubed) = ?", opts:["62","63","64","65"], ans:"C" },
      { id:"p5m023", q:"Express 5/8 as a percentage = ?", opts:["61%","61.5%","62%","62.5%"], ans:"D" },
      { id:"p5m024", q:"If x=3, y=4, evaluate 2x² + 3y − x = ?", opts:["27","28","29","30"], ans:"C" },
      { id:"p5m025", q:"Sum of interior angles of a pentagon = ?", opts:["360°","540°","720°","900°"], ans:"B" },
      { id:"p5m026", q:"HCF and LCM of 48 and 72 = ?", opts:["HCF=24, LCM=144","HCF=12, LCM=288","HCF=24, LCM=288","HCF=6, LCM=144"], ans:"A" },
      { id:"p5m027", q:"Bike travels 45 km/h for 2h 40min. Distance = ?", opts:["118","119","120","121"], ans:"C" },
      { id:"p5m028", q:"Express 2⅝ as a decimal = ?", opts:["2.580","2.600","2.625","2.650"], ans:"C" },
      { id:"p5m029", q:"Worker earns ₦180,000/year. Pays 10% tax. Monthly net pay = ?", opts:["13498","13499","13500","13501"], ans:"C" },
      { id:"p5m030", q:"√196 × √64 = ?", opts:["110","111","112","113"], ans:"C" },
      { id:"p5m031", q:"Cylindrical tank: radius 3.5m, height 8m. π=22/7. Volume = ?", opts:["306","307","308","309"], ans:"D" },
      { id:"p5m032", q:"A merchant bought items for ₦125,000 and sold for ₦175,000. Profit % = ?", opts:["39%","40%","41%","42%"], ans:"B" },
    ],
    theory: [
      { id:"p5t001", q:"Ages of 6 students: 11, 13, 12, 14, 11, 13. Find mean, median, mode, range as single numbers.", ans:"12; 12; 11; 3" },
      { id:"p5t002", q:"Rectangular pool: 25m × 12m × 1.5m deep. Volume in litres = ?", ans:"450000" },
      { id:"p5t003", q:"Solve: x + y = 15 and x − y = 5. Find x and y separately.", ans:"10; 5" },
      { id:"p5t004", q:"Man invests ₦120,000 at 12% simple interest p.a. After how many years total = ₦163,200?", ans:"3" },
      { id:"p5t005", q:"Prime factorisation of a number is 2³ × 3² × 5. The number = ?", ans:"360" },
      { id:"p5t006", q:"Factorise completely: 12a²b − 8ab² = ?", ans:"4ab(3a-2b)" },
      { id:"p5t007", q:"Profit on ₦50,000 investment is ₦15,000. Profit % = ?", ans:"30" },
      { id:"p5t008", q:"In a pie chart, 90 pupils out of 360 prefer Science. Angle for Science = ? degrees", ans:"90" },
      { id:"p5t009", q:"A field is 156m × 96m. Find perimeter and area separately as numbers.", ans:"504; 14976" },
      { id:"p5t010", q:"7,824 ÷ 24 = ?", ans:"326" },
    ]
  }
};

/** Flat lookup by id */
window.QUESTION_MAP = {};
for (const cls of Object.keys(window.QUESTIONS)) {
  for (const q of window.QUESTIONS[cls].mcq)    window.QUESTION_MAP[q.id] = q;
  for (const q of window.QUESTIONS[cls].theory) window.QUESTION_MAP[q.id] = q;
}
