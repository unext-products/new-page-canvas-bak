import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ORGANIZATION_ID = '4be340a2-38d7-4857-b797-5660c2f2258f';

// Vertical and Program ID mappings
const VERTICALS: Record<string, string> = {
  'AXILT01-26': 'ff2d373a-9dab-4c59-a886-ba546a0d7059',
  'AXIST01-26': 'cb8fe8e7-4e64-481d-9da1-ccc862963a13',
  'CBI01-26': '560df76c-1575-4649-9dc8-57c9c8afe8bd',
  'HDFC01-26': '743f2cb2-37df-43b1-999b-c5ccfdcaf09e',
  'ICICIMA-26': '02af59bb-e798-4628-90d8-aee6cfeb6305',
  'IDBIMSB-26': '67903ca8-2a2a-48e5-9f70-5968472eda59',
  'KB-01-26': '4d776c2e-76a9-4cb0-bec3-69207738b069',
  'RBL-01-26': 'd2f783cd-1fea-4b3b-b400-3a66b9fbf098',
  'STP01': '7789e70f-6ccb-4ed8-87a0-a5c6b9ec2769',
  'WILP-01-26': '2fef4995-4a33-40fe-b6a6-2e166282ce6c',
};

const PROGRAMS: Record<string, string> = {
  'AXILT01-26': '50173aec-c06b-47db-9f1d-c25c7d721f3c',
  'AXIST01-26': '0a2d4289-8051-4f36-8e1e-17301b11acd7',
  'CBI01-26': '8fb3ed9a-69cf-4f99-a373-6854fb30cae3',
  'HDFC01-26': '0d826c40-fa26-40cc-a2f9-c8e771311e45',
  'ICICIMA-26': 'a8255c75-c1f5-4eb5-86ef-a9d4be65864b',
  'IDBIMSB-26': 'a3e13654-a192-4930-86b1-a598dea22696',
  'KB-01-26': '4c7f23fb-bed6-4c92-bfb5-327786990104',
  'RBL-01-26': '0442b9f0-9761-4712-9420-03ce44b5c52d',
  'STP01': 'dd777e60-9f26-4c7e-b62e-e76a109002b3',
  'WILP-01-26': '20234163-bbc5-4965-9d5e-2a5124ec319c',
};

// All 144 users from the Excel file
const USERS = [
  // Axis-LTP (AXILT01-26) - 26 users
  { name: 'Sarika Hegde', email: 'sarika.hegde@manipal.edu', password: 'Sarika@123', vertical: 'AXILT01-26' },
  { name: 'Ajosh John', email: 'ajosh.john@manipal.edu', password: 'Ajosh@123', vertical: 'AXILT01-26' },
  { name: 'Akshatha G', email: 'akshatha.g@manipal.edu', password: 'Akshatha@123', vertical: 'AXILT01-26' },
  { name: 'Ambika M Kumar', email: 'ambika.mkumar@manipal.edu', password: 'Ambika@123', vertical: 'AXILT01-26' },
  { name: 'Bharath Kumar P', email: 'bharath.kumarp@manipal.edu', password: 'Bharath@123', vertical: 'AXILT01-26' },
  { name: 'Chandrashekar K', email: 'chandrashekar.kannaiah@u-next.com', password: 'Chandrashekar@123', vertical: 'AXILT01-26' },
  { name: 'Indira J', email: 'indira.j@manipal.edu', password: 'Indira@123', vertical: 'AXILT01-26' },
  { name: 'Naresh Kumar B', email: 'naresh.balasubramanian@u-next.com', password: 'Naresh@123', vertical: 'AXILT01-26' },
  { name: 'Sheetal Xalxo', email: 'sheetal.xalxo@manipal.edu', password: 'Sheetal@123', vertical: 'AXILT01-26' },
  { name: 'Thara Nanjundappa', email: 'thara.nanjundappa@manipal.edu', password: 'Thara@123', vertical: 'AXILT01-26' },
  { name: 'Vinay Vijayan P', email: 'vinay.vijayan@manipal.edu', password: 'Vinay@123', vertical: 'AXILT01-26' },
  { name: 'Akshatha Rai', email: 'akshatha.rai@manipal.edu', password: 'Akshatha@123', vertical: 'AXILT01-26' },
  { name: 'Ankita Sarangi', email: 'ankita.sarangi@manipal.edu', password: 'Ankita@123', vertical: 'AXILT01-26' },
  { name: 'Prakash Chandra', email: 'chandra.prakash@manipal.edu', password: 'Chandra@123', vertical: 'AXILT01-26' },
  { name: 'Damodar M Rao', email: 'damodar.rao@manipal.edu', password: 'Damodar@123', vertical: 'AXILT01-26' },
  { name: 'Joseena P U', email: 'joseena.prasad@u-next.com', password: 'Joseena@123', vertical: 'AXILT01-26' },
  { name: 'Kavita Sinha', email: 'kavita.sinha@manipal.edu', password: 'Kavita@123', vertical: 'AXILT01-26' },
  { name: 'Kavitha R', email: 'kavitha.r@manipal.edu', password: 'Kavitha@123', vertical: 'AXILT01-26' },
  { name: 'Aswathy Nair MS', email: 'nair.aswathy@manipal.edu', password: 'Nair@123', vertical: 'AXILT01-26' },
  { name: 'Rajnish Pandey', email: 'rajnish.pandey@manipal.edu', password: 'Rajnish@123', vertical: 'AXILT01-26' },
  { name: 'Ramesh Sharma', email: 'ramesh.sharma@manipal.edu', password: 'Ramesh@123', vertical: 'AXILT01-26' },
  { name: 'Rashmi Shenoy', email: 'rashmi.shenoy@u-next.com', password: 'Rashmi@123', vertical: 'AXILT01-26' },
  { name: 'Reshmi S', email: 'reshmi.s@manipal.edu', password: 'Reshmi@123', vertical: 'AXILT01-26' },
  { name: 'Sunithaasri Prasanna Jagtap', email: 'sunithaasri.jagtap@manipal.edu', password: 'Sunithaasri@123', vertical: 'AXILT01-26' },
  { name: 'Swarnalakshmi R', email: 'swarnalakshmi.r@manipal.edu', password: 'Swarnalakshmi@123', vertical: 'AXILT01-26' },
  { name: 'Saritha S', email: 'saritha.sathyaseelan@manipal.edu', password: 'Saritha@123', vertical: 'AXILT01-26' },
  
  // Axis-STP (AXIST01-26) - 9 users
  { name: 'Arvind Kumar', email: 'kumar.arvind@manipal.edu', password: 'Kumar@123', vertical: 'AXIST01-26' },
  { name: 'Manohar N', email: 'manohar.n@manipal.edu', password: 'Manohar@123', vertical: 'AXIST01-26' },
  { name: 'Shirin Seema', email: 'shirin.seema@manipal.edu', password: 'Shirin@123', vertical: 'AXIST01-26' },
  { name: 'Vijayan Venugopal', email: 'vijayan.venugopal@u-next.com', password: 'Vijayan@123', vertical: 'AXIST01-26' },
  { name: 'Viji Vijayan', email: 'viji.vijayan@manipal.edu', password: 'Viji@123', vertical: 'AXIST01-26' },
  { name: 'Sripadrao Huligeri', email: 'sripadrao.huligeri@u-next.com', password: 'Sripadrao@123', vertical: 'AXIST01-26' },
  { name: 'Jayanthi Umesh', email: 'jayanthi.umesh@u-next.com', password: 'Jayanthi@123', vertical: 'AXIST01-26' },
  { name: 'Sanjiv Kumar', email: 'sanjiv.kumar1@u-next.com', password: 'Sanjiv@123', vertical: 'AXIST01-26' },
  { name: 'Thadi Sreenivas', email: 'thadi.sreenivas@u-next.com', password: 'Thadi@123', vertical: 'AXIST01-26' },
  
  // Central Bank of India (CBI01-26) - 43 users
  { name: 'Ajay Rawat', email: 'ajay.rawat@manipal.edu', password: 'Ajay@123', vertical: 'CBI01-26' },
  { name: 'Durisetti Gopichand', email: 'durisetti.gopichand@u-next.com', password: 'Durisetti@123', vertical: 'CBI01-26' },
  { name: 'Jeya Sheela P', email: 'jeyasheela.p@manipal.edu', password: 'Jeyasheela@123', vertical: 'CBI01-26' },
  { name: 'Freena Lobo', email: 'lobo.freena@manipal.edu', password: 'Lobo@123', vertical: 'CBI01-26' },
  { name: 'Prashanth R', email: 'prashanth.ramachandra@u-next.com', password: 'Prashanth@123', vertical: 'CBI01-26' },
  { name: 'Preeti Snehasis Ghosh', email: 'preeti.ghosh@manipal.edu', password: 'Preeti@123', vertical: 'CBI01-26' },
  { name: 'Priyanka Vijay Shinde', email: 'priyanka.shinde@manipal.edu', password: 'Priyanka@123', vertical: 'CBI01-26' },
  { name: 'Ram Kumar Mula', email: 'ram.mula@manipal.edu', password: 'Ram@123', vertical: 'CBI01-26' },
  { name: 'Nair Sangeetha', email: 'sangeetha.nair@manipal.edu', password: 'Sangeetha@123', vertical: 'CBI01-26' },
  { name: 'S K V Prasad', email: 'skv.prasad@manipal.edu', password: 'Skv@123', vertical: 'CBI01-26' },
  { name: 'Srinivasa Gorlattu Shankarappa', email: 'srinivasa.shankarappa@manipal.edu', password: 'Srinivasa@123', vertical: 'CBI01-26' },
  { name: 'Sukshma S', email: 'sukshma.chandrashekar@manipal.edu', password: 'Sukshma@123', vertical: 'CBI01-26' },
  { name: 'Tejasvi Tarun', email: 'tejasvi.tarun@manipal.edu', password: 'Tejasvi@123', vertical: 'CBI01-26' },
  { name: 'Vakayil Thomas Joseph', email: 'vakayil.joseph@manipal.edu', password: 'Vakayil@123', vertical: 'CBI01-26' },
  { name: 'Dr. Sengkathir Selvan', email: 'sengkathir.selvan@u-next.com', password: 'Sengkathir@123', vertical: 'CBI01-26' },
  { name: 'Ganga Uthappa', email: 'ganga.uthappa@u-next.com', password: 'Ganga@123', vertical: 'CBI01-26' },
  { name: 'Gurupad Matolli', email: 'gurupad.matolli@u-next.com', password: 'Gurupad@123', vertical: 'CBI01-26' },
  { name: 'Mohan Raj ASG', email: 'mohan.raj@u-next.com', password: 'Mohan@123', vertical: 'CBI01-26' },
  { name: 'Mohan Shankar P', email: 'mohan.shankar1@u-next.com', password: 'Mohan@123', vertical: 'CBI01-26' },
  { name: 'Narasimhan Haravu', email: 'narasimhan.haravu@u-next.com', password: 'Narasimhan@123', vertical: 'CBI01-26' },
  { name: 'Narendra Thapa', email: 'narendra.thapa@u-next.com', password: 'Narendra@123', vertical: 'CBI01-26' },
  { name: 'Pattabi Raman', email: 'pattabi.raman@u-next.com', password: 'Pattabi@123', vertical: 'CBI01-26' },
  { name: 'Poovazhagi Venkatachalam', email: 'poovazhagi.venkatachalam@u-next.com', password: 'Poovazhagi@123', vertical: 'CBI01-26' },
  { name: 'Ramani S', email: 'ramani.sangameshwaran@u-next.com', password: 'Ramani@123', vertical: 'CBI01-26' },
  { name: 'Rati Chandra', email: 'rati.chandra@u-next.com', password: 'Rati@123', vertical: 'CBI01-26' },
  { name: 'Ravindra Rao D', email: 'ravindra.rao@u-next.com', password: 'Ravindra@123', vertical: 'CBI01-26' },
  { name: 'Renu Chopra', email: 'renu.chopra@u-next.com', password: 'Renu@123', vertical: 'CBI01-26' },
  { name: 'Sarath V', email: 'sarath.vellat@u-next.com', password: 'Sarath@123', vertical: 'CBI01-26' },
  { name: 'Sheshadri Sheshadri', email: 'sheshadri.sheshadri@u-next.com', password: 'Sheshadri@123', vertical: 'CBI01-26' },
  { name: 'Sophia M', email: 'sophia.melvin@u-next.com', password: 'Sophia@123', vertical: 'CBI01-26' },
  { name: 'VK Deshpande', email: 'krishna.deshpande@u-next.com', password: 'Krishna@123', vertical: 'CBI01-26' },
  { name: 'Raveendranath Venkata Mortha', email: 'raveendranath.mortha@u-next.com', password: 'Raveendranath@123', vertical: 'CBI01-26' },
  { name: 'Chandrakanth Vellanki', email: 'chandrakanth.v@manipal.edu', password: 'Chandrakanth@123', vertical: 'CBI01-26' },
  { name: 'Chetna Julka', email: 'chetna.julka@u-next.com', password: 'Chetna@123', vertical: 'CBI01-26' },
  { name: 'Penubotu Lalitha Sagari', email: 'lalitha.sagari@manipal.edu', password: 'Lalitha@123', vertical: 'CBI01-26' },
  { name: 'Madhukar Rao B', email: 'madhukar.rao@manipal.edu', password: 'Madhukar@123', vertical: 'CBI01-26' },
  { name: 'Rajagopal A', email: 'rajagopal.anant@u-next.com', password: 'Rajagopal@123', vertical: 'CBI01-26' },
  { name: 'Gopalakrishna Upadhya K', email: 'gopalakrishna.upadhya@u-next.com', password: 'Gopalakrishna@123', vertical: 'CBI01-26' },
  { name: 'Rajeev Ranjan', email: 'rajeev.ranjan@manipal.edu', password: 'Rajeev@123', vertical: 'CBI01-26' },
  { name: 'Shivakumar M', email: 'shivakumar.m@manipal.edu', password: 'Shivakumar@123', vertical: 'CBI01-26' },
  { name: 'Suresh Nair', email: 'suresh.nair@manipal.edu', password: 'Suresh@123', vertical: 'CBI01-26' },
  { name: 'Venkatesh Rao', email: 'venkatesh.rao@manipal.edu', password: 'Venkatesh@123', vertical: 'CBI01-26' },
  { name: 'Anitha Kumari', email: 'anitha.kumari@manipal.edu', password: 'Anitha@123', vertical: 'CBI01-26' },
  
  // HDFC Future Bankers (HDFC01-26) - 32 users
  { name: 'Aashish Rastogi', email: 'aashish.rastogi@manipal.edu', password: 'Aashish@123', vertical: 'HDFC01-26' },
  { name: 'Boby Joseph', email: 'boby.joseph@manipal.edu', password: 'Boby@123', vertical: 'HDFC01-26' },
  { name: 'Ganesh Babu Kaveti', email: 'ganesh.babu@manipal.edu', password: 'Ganesh@123', vertical: 'HDFC01-26' },
  { name: 'Gregory Fernandes', email: 'gregory.fernandes@u-next.com', password: 'Gregory@123', vertical: 'HDFC01-26' },
  { name: 'Irshath Basha A', email: 'irshath.basha@manipal.edu', password: 'Irshath@123', vertical: 'HDFC01-26' },
  { name: 'Lovekesh Singh', email: 'lovekesh.singh@manipal.edu', password: 'Lovekesh@123', vertical: 'HDFC01-26' },
  { name: 'Manaswini Acharya', email: 'manaswini.acharya@manipal.edu', password: 'Manaswini@123', vertical: 'HDFC01-26' },
  { name: 'Roopali R Baadkar', email: 'roopali.baadkar@manipal.edu', password: 'Roopali@123', vertical: 'HDFC01-26' },
  { name: 'Roshini Ganesh', email: 'roshini.ganesh@manipal.edu', password: 'Roshini@123', vertical: 'HDFC01-26' },
  { name: 'Kusuma S', email: 's.kusuma@manipal.edu', password: 'S@123', vertical: 'HDFC01-26' },
  { name: 'Vasant G Hegde', email: 'vasant.hegde@u-next.com', password: 'Vasant@123', vertical: 'HDFC01-26' },
  { name: 'Vimal Antony E', email: 'vimal.antony@manipal.edu', password: 'Vimal@123', vertical: 'HDFC01-26' },
  { name: 'Vinutha M', email: 'vinutha.mantelinga@manipal.edu', password: 'Vinutha@123', vertical: 'HDFC01-26' },
  { name: 'Anjana M V', email: 'anjana.padaki@u-next.com', password: 'Anjana@123', vertical: 'HDFC01-26' },
  { name: 'Ashwini Sudhakar Prabhu', email: 'ashwini.prabhu@manipal.edu', password: 'Ashwini@123', vertical: 'HDFC01-26' },
  { name: 'Bindu Giridhar', email: 'bindu.giridhar@manipal.edu', password: 'Bindu@123', vertical: 'HDFC01-26' },
  { name: 'Chetan B P', email: 'chetan.bp@manipal.edu', password: 'Chetan@123', vertical: 'HDFC01-26' },
  { name: 'Krishnan M', email: 'krishnan.m@manipal.edu', password: 'Krishnan@123', vertical: 'HDFC01-26' },
  { name: 'G B Nithyanand', email: 'nithyanand.gb@manipal.edu', password: 'Nithyanand@123', vertical: 'HDFC01-26' },
  { name: 'Sandur Pradeep Naidu', email: 'pradeep.naidu@manipal.edu', password: 'Pradeep@123', vertical: 'HDFC01-26' },
  { name: 'Prakash C Hiremath', email: 'prakash.hiremath@manipal.edu', password: 'Prakash@123', vertical: 'HDFC01-26' },
  { name: 'Ramalakshmi L', email: 'rama.lakshmi@u-next.com', password: 'Rama@123', vertical: 'HDFC01-26' },
  { name: 'Sridhara BN', email: 'sridhara.nanjappa@u-next.com', password: 'Sridhara@123', vertical: 'HDFC01-26' },
  { name: 'Dhananjaya Rai B', email: 'dhananjay.rai@u-next.com', password: 'Dhananjay@123', vertical: 'HDFC01-26' },
  { name: 'Meera S Anandi', email: 'meera.anandi@u-next.com', password: 'Meera@123', vertical: 'HDFC01-26' },
  { name: 'Nityanand Shetigar', email: 'nityanand.shettigar@u-next.com', password: 'Nityanand@123', vertical: 'HDFC01-26' },
  { name: 'Raghavendra Nallapeta', email: 'raghavendra.nallapeta@u-next.com', password: 'Raghavendra@123', vertical: 'HDFC01-26' },
  { name: 'Rashmi Simharaj', email: 'rashmi.simharaj@u-next.com', password: 'Rashmi@123', vertical: 'HDFC01-26' },
  { name: 'Shivanshu Jha', email: 'shivanshu.jha@u-next.com', password: 'Shivanshu@123', vertical: 'HDFC01-26' },
  { name: 'Somashekhara Shetty P', email: 'somashekara.shetty@u-next.com', password: 'Somashekara@123', vertical: 'HDFC01-26' },
  { name: 'Ann Mary Thomas Kangappadan', email: 'mary.ann@manipal.edu', password: 'Mary@123', vertical: 'HDFC01-26' },
  { name: 'Ramya Tauh', email: 'ramya.tauh@manipal.edu', password: 'Ramya@123', vertical: 'HDFC01-26' },
  
  // ICICI Manipal Academy (ICICIMA-26) - 18 users
  { name: 'Ankan Karmakar', email: 'ankan.karmakar@u-next.com', password: 'Ankan@123', vertical: 'ICICIMA-26' },
  { name: 'Arunav Das', email: 'arunav.das@u-next.com', password: 'Arunav@123', vertical: 'ICICIMA-26' },
  { name: 'Gaurav Sanyal', email: 'gaurav.sanyal@manipal.edu', password: 'Gaurav@123', vertical: 'ICICIMA-26' },
  { name: 'Lavina Mary Suares', email: 'lavina.suares@manipal.edu', password: 'Lavina@123', vertical: 'ICICIMA-26' },
  { name: 'Meena Herle', email: 'meena.herle@manipal.edu', password: 'Meena@123', vertical: 'ICICIMA-26' },
  { name: 'Payel Bhadra Kar', email: 'payel.bhadra@manipal.edu', password: 'Payel@123', vertical: 'ICICIMA-26' },
  { name: 'Pralay Brahmachari', email: 'pralay.brahmachari@manipal.edu', password: 'Pralay@123', vertical: 'ICICIMA-26' },
  { name: 'Priyamvadha OM', email: 'priyam.vadha@manipal.edu', password: 'Priyam@123', vertical: 'ICICIMA-26' },
  { name: 'Priyanka Goswami', email: 'priyanka.goswami@manipal.edu', password: 'Priyanka@123', vertical: 'ICICIMA-26' },
  { name: 'Rajashri Pillai', email: 'rajashri.pillai@manipal.edu', password: 'Rajashri@123', vertical: 'ICICIMA-26' },
  { name: 'Santoshkumar Devanaganvi', email: 'santosh.devanagavi@manipal.edu', password: 'Santosh@123', vertical: 'ICICIMA-26' },
  { name: 'Suchita Guha Saha', email: 'suchita.guha@manipal.edu', password: 'Suchita@123', vertical: 'ICICIMA-26' },
  { name: 'UK Sujith', email: 'sujith.uk@manipal.edu', password: 'Sujith@123', vertical: 'ICICIMA-26' },
  { name: 'Vasantha Shenoy', email: 'vasantha.shenoy@u-next.com', password: 'Vasantha@123', vertical: 'ICICIMA-26' },
  { name: 'Muralidhara B C', email: 'muralidhar.chandrashekar@u-next.com', password: 'Muralidhar@123', vertical: 'ICICIMA-26' },
  { name: 'Srinivas Madhyam', email: 'srinivas.mandyam@u-next.com', password: 'Srinivas@123', vertical: 'ICICIMA-26' },
  { name: 'Vijayavanitha S', email: 'vijaya.vanitha@u-next.com', password: 'Vijaya@123', vertical: 'ICICIMA-26' },
  { name: 'Deepika Rao', email: 'deepika.rao@manipal.edu', password: 'Deepika@123', vertical: 'ICICIMA-26' },
  
  // IDBI Manipal School Of Banking (IDBIMSB-26) - 9 users
  { name: 'Santhanam Iyer', email: 'santhanam.iyer@u-next.com', password: 'Santhanam@123', vertical: 'IDBIMSB-26' },
  { name: 'Archana Mishra', email: 'archana.mishra@u-next.com', password: 'Archana@123', vertical: 'IDBIMSB-26' },
  { name: 'S Chithra', email: 'chitra.shivanandan@u-next.com', password: 'Chitra@123', vertical: 'IDBIMSB-26' },
  { name: 'Monika Shahi', email: 'monika.shahi@manipal.edu', password: 'Monika@123', vertical: 'IDBIMSB-26' },
  { name: 'Sudhanshu Narain', email: 'sudhanshu.narain@manipal.edu', password: 'Sudhanshu@123', vertical: 'IDBIMSB-26' },
  { name: 'Susan John', email: 'susan.john@manipal.edu', password: 'Susan@123', vertical: 'IDBIMSB-26' },
  { name: 'Maheswarappa B S', email: 'maheshwarappa.siddalingegowda@u-next.com', password: 'Maheshwarappa@123', vertical: 'IDBIMSB-26' },
  { name: 'Sunanda Nayak', email: 'sunanda.nayak@u-next.com', password: 'Sunanda@123', vertical: 'IDBIMSB-26' },
  { name: 'Radhika A', email: 'radhika.arun@manipal.edu', password: 'Radhika@123', vertical: 'IDBIMSB-26' },
  
  // Kotak (KB-01-26) - 6 users
  { name: 'Hari Raj', email: 'hari.raj@u-next.com', password: 'Hari@123', vertical: 'KB-01-26' },
  { name: 'Lakshmi Priyadarshini', email: 'lakshmi.priyadarshini@u-next.com', password: 'Lakshmi@123', vertical: 'KB-01-26' },
  { name: 'Nagaraj Krishnaji Patil', email: 'nagaraj.patil@u-next.com', password: 'Nagaraj@123', vertical: 'KB-01-26' },
  { name: 'Pralay Dey', email: 'pralay.dey@u-next.com', password: 'Pralay@123', vertical: 'KB-01-26' },
  { name: 'Vidya Radhakrishnan', email: 'r.vidya@manipal.edu', password: 'Vidya@123', vertical: 'KB-01-26' },
  { name: 'Santosh B M', email: 'santosh.bm@manipal.edu', password: 'Santosh@123', vertical: 'KB-01-26' },
  
  // RBL (RBL-01-26) - 1 user
  { name: 'Kavitha Rao', email: 'kavitha.rao@manipal.edu', password: 'Kavitha@123', vertical: 'RBL-01-26' },
  
  // Short Term Programs (STP01) - 6 users
  { name: 'Smita Venugopal', email: 'smita.venugopal@u-next.com', password: 'Smita@123', vertical: 'STP01' },
  { name: 'Kadiresan D', email: 'kadiresan.dhanasekaran@u-next.com', password: 'Kadiresan@123', vertical: 'STP01' },
  { name: 'Kurian James', email: 'kurian.james@u-next.com', password: 'Kurian@123', vertical: 'STP01' },
  { name: 'Prasenjit Swar', email: 'prasenjit.swar@manipal.edu', password: 'Prasenjit@123', vertical: 'STP01' },
  { name: 'Srinivasa S R', email: 'srinivasa.susurla@u-next.com', password: 'Srinivasa@123', vertical: 'STP01' },
  { name: 'Venkitakrishnan H Hariharan', email: 'venkitakrishnan.h@manipal.edu', password: 'Venkitakrishnan@123', vertical: 'STP01' },
  
  // WILP (WILP-01-26) - 1 user
  { name: 'Sushmitha H K', email: 'hk.sushmitha@manipal.edu', password: 'Hk@123', vertical: 'WILP-01-26' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
      details: [] as { email: string; status: string; error?: string }[],
    };

    console.log(`Starting bulk user creation for ${USERS.length} users`);

    for (const user of USERS) {
      const verticalId = VERTICALS[user.vertical];
      const programId = PROGRAMS[user.vertical];

      if (!verticalId || !programId) {
        results.failed++;
        results.errors.push(`Missing vertical/program mapping for ${user.email} (${user.vertical})`);
        results.details.push({ email: user.email, status: 'failed', error: 'Missing mapping' });
        continue;
      }

      try {
        console.log(`Creating user: ${user.email}`);

        // Create auth user
        const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: { full_name: user.name },
        });

        if (authError) {
          if (authError.message.includes('already been registered')) {
            console.log(`User ${user.email} already exists, skipping`);
            results.skipped++;
            results.details.push({ email: user.email, status: 'skipped', error: 'Already exists' });
            continue;
          }
          throw authError;
        }

        const userId = authData.user.id;

        // Update profile
        await supabaseClient
          .from('profiles')
          .update({ full_name: user.name, is_active: true })
          .eq('id', userId);

        // Create user role
        const { error: roleError } = await supabaseClient
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'l1',
            organization_id: ORGANIZATION_ID,
            vertical_id: verticalId,
            program_id: programId,
          });

        if (roleError) {
          console.error(`Role error for ${user.email}:`, roleError);
          throw roleError;
        }

        // Add to user_verticals junction table
        const { error: verticalError } = await supabaseClient
          .from('user_verticals')
          .insert({
            user_id: userId,
            vertical_id: verticalId,
          });

        if (verticalError) {
          console.error(`Vertical assignment error for ${user.email}:`, verticalError);
        }

        // Add to user_programs junction table
        const { error: programError } = await supabaseClient
          .from('user_programs')
          .insert({
            user_id: userId,
            program_id: programId,
          });

        if (programError) {
          console.error(`Program assignment error for ${user.email}:`, programError);
        }

        results.created++;
        results.details.push({ email: user.email, status: 'created' });
        console.log(`Successfully created user: ${user.email}`);

      } catch (error) {
        console.error(`Failed to create user ${user.email}:`, error);
        results.failed++;
        results.errors.push(`${user.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.details.push({ email: user.email, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log(`Bulk creation complete. Created: ${results.created}, Skipped: ${results.skipped}, Failed: ${results.failed}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Bulk user creation complete`,
      summary: {
        total: USERS.length,
        created: results.created,
        skipped: results.skipped,
        failed: results.failed,
      },
      errors: results.errors,
      details: results.details,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in seed-mab-faculty:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to seed users',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
