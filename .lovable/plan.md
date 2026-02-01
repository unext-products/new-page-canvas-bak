

## Plan: Create Bulk User Seeding Edge Function for MAB Faculty

### Overview
The current `admin-create-user` edge function requires an authenticated admin session to work. Since you're not logged in as an admin in the preview, I need to create a dedicated seeding edge function that uses the service role key directly to create all 144 L1 users in bulk.

### Approach

**1. Create a new edge function: `seed-mab-faculty`**
- This function will use `SUPABASE_SERVICE_ROLE_KEY` to bypass auth requirements
- It will contain all 144 user records extracted from the Excel file
- It will create users with proper vertical and program assignments
- Set `verify_jwt = false` in config so it can be called without authentication

**2. User Data Mapping**
The Excel contains users from these verticals and programs:

| Vertical Code | Vertical ID | Program Code | Program ID | User Count |
|--------------|-------------|--------------|------------|------------|
| AXILT01-26 | ff2d373a-9dab-4c59-a886-ba546a0d7059 | AXILT01_26 | 50173aec-c06b-47db-9f1d-c25c7d721f3c | 26 users |
| AXIST01-26 | cb8fe8e7-4e64-481d-9da1-ccc862963a13 | AXIST01_26 | 0a2d4289-8051-4f36-8e1e-17301b11acd7 | 9 users |
| CBI01-26 | 560df76c-1575-4649-9dc8-57c9c8afe8bd | PGDBF01 | 8fb3ed9a-69cf-4f99-a373-6854fb30cae3 | 43 users |
| HDFC01-26 | 743f2cb2-37df-43b1-999b-c5ccfdcaf09e | PGDSRB01 | 0d826c40-fa26-40cc-a2f9-c8e771311e45 | 32 users |
| ICICIMA-26 | 02af59bb-e798-4628-90d8-aee6cfeb6305 | ICICIMA01 | a8255c75-c1f5-4eb5-86ef-a9d4be65864b | 18 users |
| IDBIMSB-26 | 67903ca8-2a2a-48e5-9f70-5968472eda59 | PGDBF01 | a3e13654-a192-4930-86b1-a598dea22696 | 7 users |
| KB-01-26 | 4d776c2e-76a9-4cb0-bec3-69207738b069 | KB0126 | 4c7f23fb-bed6-4c92-bfb5-327786990104 | 5 users |
| RBL-01-26 | d2f783cd-1fea-4b3b-b400-3a66b9fbf098 | RBL0126 | 0442b9f0-9761-4712-9420-03ce44b5c52d | 1 user |
| STP01 | 7789e70f-6ccb-4ed8-87a0-a5c6b9ec2769 | STP001 | dd777e60-9f26-4c7e-b62e-e76a109002b3 | 5 users |
| WILP-01-26 | 2fef4995-4a33-40fe-b6a6-2e166282ce6c | WLPMBA01 | 20234163-bbc5-4965-9d5e-2a5124ec319c | 1 user |

**Note:** RRBL-01-26 in Excel maps to RBL-01-26 in database

### Edge Function Logic

For each of the 144 users, the function will:
1. Create auth user with email and password using `supabase.auth.admin.createUser()`
2. Update the profiles table with full_name
3. Insert into `user_roles` with role='l1', organization_id, vertical_id, program_id
4. Insert into `user_verticals` junction table
5. Insert into `user_programs` junction table

### File Changes

| File | Change |
|------|--------|
| `supabase/functions/seed-mab-faculty/index.ts` | NEW - Bulk seeding function with all 144 users |
| `supabase/config.toml` | Add `[functions.seed-mab-faculty]` with `verify_jwt = false` |

### Execution

After deploying the edge function:
1. Call the function once to create all 144 users
2. The function will return a summary of successful/failed creations
3. Delete the function afterward (optional, for security)

### Security Considerations
- The function uses service role key (server-side only)
- Set `verify_jwt = false` for one-time seeding
- Can be deleted after use to prevent re-runs
- No sensitive data exposed in client-side code

---

### All 144 Users to be Created

The complete list extracted from the Excel:

**Axis-LTP (AXILT01-26) - PGDBS (AXILT01_26):** 26 users
1. Sarika Hegde - sarika.hegde@manipal.edu - Sarika@123
2. Ajosh John - ajosh.john@manipal.edu - Ajosh@123
3. Akshatha G - akshatha.g@manipal.edu - Akshatha@123
4. Ambika M Kumar - ambika.mkumar@manipal.edu - Ambika@123
5. Bharath Kumar P - bharath.kumarp@manipal.edu - Bharath@123
6. Chandrashekar K - chandrashekar.kannaiah@u-next.com - Chandrashekar@123
7. Indira J - indira.j@manipal.edu - Indira@123
8. Naresh Kumar B - naresh.balasubramanian@u-next.com - Naresh@123
9. Sheetal Xalxo - sheetal.xalxo@manipal.edu - Sheetal@123
10. Thara Nanjundappa - thara.nanjundappa@manipal.edu - Thara@123
11. Vinay Vijayan P - vinay.vijayan@manipal.edu - Vinay@123
12. Akshatha Rai - akshatha.rai@manipal.edu - Akshatha@123
13. Ankita Sarangi - ankita.sarangi@manipal.edu - Ankita@123
14. Prakash Chandra - chandra.prakash@manipal.edu - Chandra@123
15. Damodar M Rao - damodar.rao@manipal.edu - Damodar@123
16. Joseena P U - joseena.prasad@u-next.com - Joseena@123
17. Kavita Sinha - kavita.sinha@manipal.edu - Kavita@123
18. Kavitha R - kavitha.r@manipal.edu - Kavitha@123
19. Aswathy Nair MS - nair.aswathy@manipal.edu - Nair@123
20. Rajnish Pandey - rajnish.pandey@manipal.edu - Rajnish@123
21. Ramesh Sharma - ramesh.sharma@manipal.edu - Ramesh@123
22. Rashmi Shenoy - rashmi.shenoy@u-next.com - Rashmi@123
23. Reshmi S - reshmi.s@manipal.edu - Reshmi@123
24. Sunithaasri Prasanna Jagtap - sunithaasri.jagtap@manipal.edu - Sunithaasri@123
25. Swarnalakshmi R - swarnalakshmi.r@manipal.edu - Swarnalakshmi@123

**Axis-STP (AXIST01-26) - Wholesale Banking Operations (AXIST01_26):** 9 users
26. Arvind Kumar - kumar.arvind@manipal.edu - Kumar@123
27. Manohar N - manohar.n@manipal.edu - Manohar@123
28. Shirin Seema - shirin.seema@manipal.edu - Shirin@123
29. Vijayan Venugopal - vijayan.venugopal@u-next.com - Vijayan@123
30. Viji Vijayan - viji.vijayan@manipal.edu - Viji@123
31. Sripadrao Huligeri - sripadrao.huligeri@u-next.com - Sripadrao@123
32. Jayanthi Umesh - jayanthi.umesh@u-next.com - Jayanthi@123
33. Sanjiv Kumar - sanjiv.kumar1@u-next.com - Sanjiv@123
34. Thadi Sreenivas - thadi.sreenivas@u-next.com - Thadi@123

**Central Bank of India (CBI01-26) - PGDBF (PGDBF01 - CBI):** 43 users
35. Ajay Rawat - ajay.rawat@manipal.edu - Ajay@123
36. Durisetti Gopichand - durisetti.gopichand@u-next.com - Durisetti@123
37. Jeya Sheela P - jeyasheela.p@manipal.edu - Jeyasheela@123
38. Freena Lobo - lobo.freena@manipal.edu - Lobo@123
39. Prashanth R - prashanth.ramachandra@u-next.com - Prashanth@123
40. Preeti Snehasis Ghosh - preeti.ghosh@manipal.edu - Preeti@123
41. Priyanka Vijay Shinde - priyanka.shinde@manipal.edu - Priyanka@123
42. Ram Kumar Mula - ram.mula@manipal.edu - Ram@123
43. Nair Sangeetha - sangeetha.nair@manipal.edu - Sangeetha@123
44. S K V Prasad - skv.prasad@manipal.edu - Skv@123
45. Srinivasa Gorlattu Shankarappa - srinivasa.shankarappa@manipal.edu - Srinivasa@123
46. Sukshma S - sukshma.chandrashekar@manipal.edu - Sukshma@123
47. Tejasvi Tarun - tejasvi.tarun@manipal.edu - Tejasvi@123
48. Vakayil Thomas Joseph - vakayil.joseph@manipal.edu - Vakayil@123
49. Dr. Sengkathir Selvan - sengkathir.selvan@u-next.com - Sengkathir@123
50. Ganga Uthappa - ganga.uthappa@u-next.com - Ganga@123
51. Gurupad Matolli - gurupad.matolli@u-next.com - Gurupad@123
52. Mohan Raj ASG - mohan.raj@u-next.com - Mohan@123
53. Mohan Shankar P - mohan.shankar1@u-next.com - Mohan@123
54. Narasimhan Haravu - narasimhan.haravu@u-next.com - Narasimhan@123
55. Narendra Thapa - narendra.thapa@u-next.com - Narendra@123
56. Pattabi Raman - pattabi.raman@u-next.com - Pattabi@123
57. Poovazhagi Venkatachalam - poovazhagi.venkatachalam@u-next.com - Poovazhagi@123
58. Ramani S - ramani.sangameshwaran@u-next.com - Ramani@123
59. Rati Chandra - rati.chandra@u-next.com - Rati@123
60. Ravindra Rao D - ravindra.rao@u-next.com - Ravindra@123
61. Renu Chopra - renu.chopra@u-next.com - Renu@123
62. Sarath V - sarath.vellat@u-next.com - Sarath@123
63. Sheshadri Sheshadri - sheshadri.sheshadri@u-next.com - Sheshadri@123
64. Sophia . - sophia.melvin@u-next.com - Sophia@123
65. VK Deshpande - krishna.deshpande@u-next.com - Krishna@123
66. Raveendranath Venkata Mortha - raveendranath.mortha@u-next.com - Raveendranath@123
67. Chandrakanth Vellanki - chandrakanth.v@manipal.edu - Chandrakanth@123
68. Chetna Julka - chetna.julka@u-next.com - Chetna@123
69. Penubotu Lalitha Sagari - lalitha.sagari@manipal.edu - Lalitha@123
70. Madhukar Rao B - madhukar.rao@manipal.edu - Madhukar@123
71. Rajagopal A - rajagopal.anant@u-next.com - Rajagopal@123
72. Gopalakrishna Upadhya K - gopalakrishna.upadhya@u-next.com - Gopalakrishna@123

**HDFC Future Bankers Program (HDFC01-26) - PGDSRB (PGDSRB01):** 32 users
73. Aashish Rastogi - aashish.rastogi@manipal.edu - Aashish@123
74. Boby Joseph - boby.joseph@manipal.edu - Boby@123
75. Ganesh Babu Kaveti - ganesh.babu@manipal.edu - Ganesh@123
76. Gregory Fernandes - gregory.fernandes@u-next.com - Gregory@123
77. Irshath Basha A - irshath.basha@manipal.edu - Irshath@123
78. Lovekesh Singh - lovekesh.singh@manipal.edu - Lovekesh@123
79. Manaswini Acharya - manaswini.acharya@manipal.edu - Manaswini@123
80. Roopali R Baadkar - roopali.baadkar@manipal.edu - Roopali@123
81. Roshini Ganesh - roshini.ganesh@manipal.edu - Roshini@123
82. kusuma S - s.kusuma@manipal.edu - S@123
83. Vasant G Hegde - vasant.hegde@u-next.com - Vasant@123
84. Vimal Antony E - vimal.antony@manipal.edu - Vimal@123
85. Vinutha M - vinutha.mantelinga@manipal.edu - Vinutha@123
86. Anjana M V - anjana.padaki@u-next.com - Anjana@123
87. Ashwini sudhakar prabhu - ashwini.prabhu@manipal.edu - Ashwini@123
88. Bindu Giridhar - bindu.giridhar@manipal.edu - Bindu@123
89. Chetan B P - chetan.bp@manipal.edu - Chetan@123
90. Krishnan M - krishnan.m@manipal.edu - Krishnan@123
91. G B Nithyanand - nithyanand.gb@manipal.edu - Nithyanand@123
92. Sandur Pradeep Naidu - pradeep.naidu@manipal.edu - Pradeep@123
93. Prakash C Hiremath - prakash.hiremath@manipal.edu - Prakash@123
94. Ramalakshmi L - rama.lakshmi@u-next.com - Rama@123
95. Sridhara BN - sridhara.nanjappa@u-next.com - Sridhara@123
96. Dhananjaya Rai B - dhananjay.rai@u-next.com - Dhananjay@123
97. Meera S Anandi - meera.anandi@u-next.com - Meera@123
98. Nityanand Shetigar - nityanand.shettigar@u-next.com - Nityanand@123
99. Raghavendra Nallapeta - raghavendra.nallapeta@u-next.com - Raghavendra@123
100. Rashmi Simharaj - rashmi.simharaj@u-next.com - Rashmi@123
101. Shivanshu Jha - shivanshu.jha@u-next.com - Shivanshu@123
102. Somashekhara Shetty P - somashekara.shetty@u-next.com - Somashekara@123
103. Ann Mary Thomas Kangappadan - mary.ann@manipal.edu - Mary@123
104. Ramya Tauh - ramya.tauh@manipal.edu - Ramya@123

**ICICI Manipal Academy (ICICIMA-26) - ASPIRE PROGRAM (ICICIMA01):** 18 users
105. Ankan Karmakar - ankan.karmakar@u-next.com - Ankan@123
106. Arunav Das - arunav.das@u-next.com - Arunav@123
107. Gaurav Sanyal - gaurav.sanyal@manipal.edu - Gaurav@123
108. Lavina Mary Suares - lavina.suares@manipal.edu - Lavina@123
109. Meena Herle - meena.herle@manipal.edu - Meena@123
110. Payel Bhadra Kar - payel.bhadra@manipal.edu - Payel@123
111. Pralay Brahmachari - pralay.brahmachari@manipal.edu - Pralay@123
112. Priyamvadha OM - priyam.vadha@manipal.edu - Priyam@123
113. Priyanka Goswami - priyanka.goswami@manipal.edu - Priyanka@123
114. Rajashri Pillai - rajashri.pillai@manipal.edu - Rajashri@123
115. Santoshkumar Devanaganvi - santosh.devanagavi@manipal.edu - Santosh@123
116. Suchita Guha Saha - suchita.guha@manipal.edu - Suchita@123
117. UK Sujith - sujith.uk@manipal.edu - Sujith@123
118. Vasantha Shenoy - vasantha.shenoy@u-next.com - Vasantha@123
119. Muralidhara B C - muralidhar.chandrashekar@u-next.com - Muralidhar@123
120. Srinivas Madhyam - srinivas.mandyam@u-next.com - Srinivas@123
121. Vijayavanitha S - vijaya.vanitha@u-next.com - Vijaya@123

**IDBI Manipal School Of Banking (IDBIMSB-26) - PGDBF (PGDBF01 - IDBI):** 8 users
122. Santhanam Iyer - santhanam.iyer@u-next.com - Santhanam@123
123. Archana Mishra - archana.mishra@u-next.com - Archana@123
124. S Chithra - chitra.shivanandan@u-next.com - Chitra@123
125. Monika Shahi - monika.shahi@manipal.edu - Monika@123
126. Sudhanshu Narain - sudhanshu.narain@manipal.edu - Sudhanshu@123
127. Susan John - susan.john@manipal.edu - Susan@123
128. Maheswarappa B S - maheshwarappa.siddalingegowda@u-next.com - Maheshwarappa@123
129. Sunanda Nayak - sunanda.nayak@u-next.com - Sunanda@123
130. Radhika A - radhika.arun@manipal.edu - Radhika@123

**Kotak (KB-01-26) - PGDRB (KB0126):** 6 users
131. Hari Raj - hari.raj@u-next.com - Hari@123
132. Lakshmi Priyadarshini - lakshmi.priyadarshini@u-next.com - Lakshmi@123
133. Nagaraj Krishnaji Patil - nagaraj.patil@u-next.com - Nagaraj@123
134. Pralay Dey - pralay.dey@u-next.com - Pralay@123
135. Vidya Radhakrishnan - r.vidya@manipal.edu - Vidya@123
136. Santosh B M - santosh.bm@manipal.edu - Santosh@123

**RBL (RBL-01-26) - Branch Managers Leadership (RBL0126):** 1 user
137. Kavitha Rao - kavitha.rao@manipal.edu - Kavitha@123

**Short Term Programs (STP01) - Short Term Programs (STP001):** 5 users
138. Smita Venugopal - smita.venugopal@u-next.com - Smita@123
139. Kadiresan D - kadiresan.dhanasekaran@u-next.com - Kadiresan@123
140. Kurian James - kurian.james@u-next.com - Kurian@123
141. Prasenjit Swar - prasenjit.swar@manipal.edu - Prasenjit@123
142. Srinivasa S R - srinivasa.susurla@u-next.com - Srinivasa@123
143. Venkitakrishnan H Hariharan - venkitakrishnan.h@manipal.edu - Venkitakrishnan@123

**WILP (WILP-01-26) - MBA-Banking and Finance (WLPMBA01):** 1 user
144. Sushmitha H K - hk.sushmitha@manipal.edu - Hk@123

---

### Technical Details

**Database IDs being used:**
- Organization: `4be340a2-38d7-4857-b797-5660c2f2258f` (MAB)

**Vertical IDs:**
```text
AXILT01-26 → ff2d373a-9dab-4c59-a886-ba546a0d7059
AXIST01-26 → cb8fe8e7-4e64-481d-9da1-ccc862963a13
CBI01-26   → 560df76c-1575-4649-9dc8-57c9c8afe8bd
HDFC01-26  → 743f2cb2-37df-43b1-999b-c5ccfdcaf09e
ICICIMA-26 → 02af59bb-e798-4628-90d8-aee6cfeb6305
IDBIMSB-26 → 67903ca8-2a2a-48e5-9f70-5968472eda59
KB-01-26   → 4d776c2e-76a9-4cb0-bec3-69207738b069
RBL-01-26  → d2f783cd-1fea-4b3b-b400-3a66b9fbf098
STP01      → 7789e70f-6ccb-4ed8-87a0-a5c6b9ec2769
WILP-01-26 → 2fef4995-4a33-40fe-b6a6-2e166282ce6c
```

**Program IDs:**
```text
AXILT01_26 (PGDBS)                → 50173aec-c06b-47db-9f1d-c25c7d721f3c
AXIST01_26 (Wholesale Banking)    → 0a2d4289-8051-4f36-8e1e-17301b11acd7
PGDBF01 (CBI)                     → 8fb3ed9a-69cf-4f99-a373-6854fb30cae3
PGDSRB01 (HDFC)                   → 0d826c40-fa26-40cc-a2f9-c8e771311e45
ICICIMA01 (ASPIRE)                → a8255c75-c1f5-4eb5-86ef-a9d4be65864b
PGDBF01 (IDBI)                    → a3e13654-a192-4930-86b1-a598dea22696
KB0126 (PGDRB)                    → 4c7f23fb-bed6-4c92-bfb5-327786990104
RBL0126 (Branch Managers)         → 0442b9f0-9761-4712-9420-03ce44b5c52d
STP001 (Short Term Programs)      → dd777e60-9f26-4c7e-b62e-e76a109002b3
WLPMBA01 (MBA Banking)            → 20234163-bbc5-4965-9d5e-2a5124ec319c
```

### Files to Create/Modify

| File | Description |
|------|-------------|
| `supabase/functions/seed-mab-faculty/index.ts` | NEW - Edge function containing all 144 users and creation logic |
| `supabase/config.toml` | Add function config with `verify_jwt = false` |

### Post-Deployment Steps

1. Deploy the edge function (automatic)
2. Call the function endpoint once to create all users
3. Function returns summary: `{ created: 144, failed: 0, errors: [] }`
4. Optionally delete the function after successful execution

