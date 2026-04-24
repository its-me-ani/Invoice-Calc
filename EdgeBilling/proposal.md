 

Agentic Invoice Co-Pilot for Government Billing 

PWA + iOS/Android + Web3 Payments 

DMP 2026 · NSUT · Financial Inclusion 

Overview 

An Agentic Web3 Invoice Co-Pilot — a cross-platform billing system designed for government and educational institutions. It combines AI-driven workflows to automate invoice creation, validation, and management, reducing manual errors and improving efficiency. The system leverages decentralized storage (Filecoin/IPFS) for secure, tamper-proof recordkeeping, along with blockchain-based programmable payments for automated and conditional settlements. Delivered as a PWA and mobile apps, it enables transparent, scalable, and intelligent financial operations — transforming traditional billing into an automated, reliable, and accessible system for large-scale public sector use cases. 

Why I Chose This Project 

I've spent the past year working with SocialCalc spreadsheets, gaining hands-on experience with invoice structures and creating agentic invoice generation pipelines and workflows. I've explored integrating AI agents to generate invoices from scratch, detect errors, assist in edits, and create summaries. This project lets me extend that work into a fully agentic, autonomous invoicing system with real-world use cases like programmable payments and pay-per-use models. I'm particularly motivated to scale it across platforms (PWA, iOS/Android), with an existing Play Store deployment of the Invoice app already in progress. 

Open-Source Contributions 

ZK Medical Billing — Angular to Ionic+React Migration 

Migration of the old Angular invoice billing app to a newer Ionic + React version. 

github.com/seetadev/ZKMedical-Billing/issues/36 

ZK Medical Billing — Starknet Integration 

Implemented key features for the Starknet-integrated billing system, including multi-subscription support using Medi Token, production-ready data storage/retrieval, and resolving storage issues. Added signature plugins for secure document validation — enhancing functionality, reliability, and real-world usability. 

github.com/seetadev/ZKMedical-Billing/issues/39 

Technical Skills 

Advanced: Python, React, Git, Linux, AWS, MySQL 

Intermediate: C++, JavaScript, Node.js, Machine Learning, UI/UX, GCP, MongoDB, Docker, PostgreSQL 

Relevance to the Project 

I have hands-on experience building cross-platform apps using Ionic + React, including PWAs and mobile deployments. I've worked across multiple chains (Filecoin, Starknet, Optimism, Sepolia) using Solidity and Cairo, which fits the Web3 payment layer. I've also built agentic pipelines, generating ~900 invoice templates using Gemini (Vertex AI on GCP). Additionally, I've deployed AI-integrated apps on AWS using Bedrock (Claude API), a Docker-based Flask server on App Runner, EC2, S3, DynamoDB, and Cognito — ensuring scalable and production-ready systems. 

 

 

Relevant Coursework 

Data Structures and Algorithms, Databases, Operating Systems, Object Oriented Programming, Computer Networks, Machine Learning, Natural Language Processing, Artificial Intelligence. 

Selected Projects 

InvoiceCalc 

A platform using SocialCalc spreadsheets for creating and managing invoices — making billing simpler and more structured. The goal was to reduce manual effort, improve accuracy, and enable easy editing, validation, and sharing of invoices with reliable backend support. 

Role: Full-stack developer responsible for the SocialCalc-based invoicing system, backend APIs, PDF generation workflows, and secure authentication/storage using AWS services. 

ScheduleX 

A scheduling and timetable management app that reduces manual entry errors and simplifies sharing and planning. Users can create, manage, and optimize schedules using structured inputs like CSVs and constraints — improving usability and reducing repetitive scheduling effort. 

Role: Developed as a personal project, later open-sourced and grew a contributor community. Led end-to-end development including frontend, state management, and AI-based timetable generation. 

TypeDash 

A real-time multiplayer typing platform that makes typing practice engaging and competitive. It enables 1v1 races with live synchronization, reducing isolation in traditional typing tools through a fast, responsive, and visually appealing interface. 

Role: Developed from scratch, later scaled into a live typing marathon for a club exhibition with 500+ races. Handled full-stack development, real-time socket integration, custom UI/UX in Illustrator, and Docker deployment. 

System Understanding 

Key Components 

The system consists of a cross-platform frontend built using Ionic/Capacitor (PWA + mobile apps), an AI-driven co-pilot layer for invoice generation and validation, and a backend/API layer for processing workflows. It integrates decentralized storage via Filecoin/IPFS for secure, tamper-proof recordkeeping. A blockchain-based payment layer enables programmable settlements using standards like x402, MPP, and ERC-8004. Additional components include export modules (CSV/HTML/email), authentication, and modular APIs for extensibility and integration with external systems. 

Product Owner 

The project is led by a collaboration between NSUT, SEETA, and AIC, focused on building public digital infrastructure. These organizations work toward developing scalable, open, and impactful technology solutions — especially in domains like financial inclusion and governance. Their goal is to enable transparent, efficient, and accessible systems for institutions using modern technologies such as AI, blockchain, and decentralized storage, while promoting open-source collaboration and real-world adoption. 

Repository Summary 

The Agentic Invoice Co-Pilot is a cross-platform billing system for government and educational institutions. It provides an intelligent interface to create, validate, manage, and export invoices with minimal manual effort. The system combines AI workflows with decentralized storage and blockchain-based payments to ensure transparency, automation, and auditability. It is designed as a reusable, modular public-good service deployable across web and mobile platforms. 

Problem Being Solved 

Traditional billing systems in public institutions are often manual, error-prone, and lack transparency — leading to inefficiencies, delays, and difficulty in auditing financial records. The project addresses these issues by automating invoice creation, validation, and payments while ensuring secure and verifiable storage. This is important for improving operational efficiency, reducing human errors, and enabling transparent financial workflows in large-scale public sector systems. 

Key Challenges 

Major challenges include ensuring accuracy and reliability in AI-driven invoice generation, handling diverse invoice formats, and maintaining real-time validation without errors. Integrating decentralized storage and blockchain payments adds complexity in performance, cost, and interoperability. Building a seamless cross-platform experience (PWA + mobile) while maintaining scalability and usability is also challenging. Additionally, ensuring security, compliance, and smooth integration with existing institutional systems is critical. 

Stakeholders & End Users 

End users include government officials, administrative staff, and institutional users responsible for billing and financial management. Stakeholders include public institutions, developers integrating the system, and organizations maintaining the infrastructure. The solution benefits them by reducing manual workload, improving accuracy, enabling automated payments, and ensuring transparent and auditable records. It also supports developers and organizations by providing reusable modules and APIs for broader adoption. 

 

 

 

Proposed Solution 

A cross-platform Agentic Invoice Co-Pilot that simplifies and automates billing workflows for government and educational institutions. The system will be built using Ionic + Capacitor for a unified codebase across PWA, Android, and iOS — ensuring accessibility and scalability. 

At the core, the application will provide an intelligent invoice interface where users can create, edit, and manage invoices through structured inputs such as forms, spreadsheets, or uploaded files. An AI-assisted layer will support invoice generation, validation, and correction by analyzing patterns, detecting inconsistencies, and suggesting improvements — significantly reducing manual errors. 

For storage, the system will integrate Filecoin/IPFS for secure, tamper-proof, and verifiable invoice records. Each invoice will be content-addressed, enabling traceability and auditability. The backend will expose modular APIs for invoice processing, storage interactions, and workflow orchestration. 

A key aspect is programmable payments. By integrating blockchain-based payment standards such as x402, MPP (Tempo), and ERC-8004, the system will enable automated and conditional invoice settlements — including milestone-based payments, streaming payments, and multi-party distribution without manual intervention. 

The system will also include export and communication features — invoices can be downloaded, shared via email, or printed in standardized formats. Native capabilities through Capacitor plugins (file system, sharing, email) will enhance mobile usability. Overall, the solution combines AI assistance, decentralized storage, and programmable payments into a unified platform. 

Alignment with Project Goals 

The solution directly aligns with the project goals through AI-assisted invoice generation and validation, cross-platform deployment (PWA + mobile), decentralized storage via Filecoin/IPFS, and programmable payment workflows. It focuses on delivering a functional co-pilot system that reduces manual effort, improves accuracy, and ensures transparency. Modular components and scalable APIs support reusability and integration, matching the expected outcome of a production-ready, extensible public-good billing system. 

Implementation Plan 

Implementation will start with setting up the Ionic + Capacitor frontend and core invoice UI. Next, backend APIs will be developed for invoice creation, validation, and storage integration with Filecoin/IPFS. AI-assisted workflows for generation and validation will be integrated, followed by export features. Blockchain-based payment flows will then be added. Finally, the system will be tested across PWA, Android, and iOS — ensuring performance, security, and end-to-end workflow completion. 

Assumptions 

Users have basic digital literacy to interact with forms or spreadsheets for invoice creation, and reliable internet access for decentralized storage and blockchain interactions. The accuracy of AI-assisted workflows depends on well-structured input data and predefined templates. Required APIs, blockchain endpoints, and storage services (Filecoin/IPFS) are assumed to be accessible and stable. Institutional adoption may require minimal customization and compliance alignment with existing billing processes. 

Execution Risks & Mitigation 

Key risks include inaccuracies in AI-generated invoices, integration complexity across blockchain and storage systems, and performance issues in cross-platform deployment. There may also be challenges in handling diverse invoice formats and ensuring data consistency. Mitigations: strict validation layers, fallback manual controls, and structured templates; modular architecture to reduce integration risks; thorough testing across PWA and mobile platforms; and caching, retries, and monitoring to maintain performance and reliability. 

Meeting Acceptance Criteria 

The solution delivers end-to-end workflows — invoice creation, validation, storage, export, and payment. It ensures cross-platform functionality (PWA, Android, iOS) using Ionic + Capacitor, integrates Filecoin/IPFS for secure storage, and implements programmable payment flows. Features like real-time validation, export options, and modular APIs align with usability and extensibility requirements. The system will be fully deployable, documented, and tested. 

Improvements Beyond the Expected Outcome 

My solution extends the expected outcome by focusing on production-readiness, usability, and real-world adoption. Beyond basic functionality, it emphasizes a seamless cross-platform experience, optimized performance, and structured invoice workflows using spreadsheet-like interfaces. Better validation layers and modular APIs make the system easier to integrate and scale. Enhanced export, versioning, and user-friendly UI/UX features ensure the solution is practical for everyday institutional use. 

Reference to Documentation & Mockups 

I referred to the provided project documentation — repository details, architecture guidelines, and setup instructions. These helped in understanding the system design, expected workflows, and integration points such as storage, payments, and cross-platform deployment. While there were no strict mockups, I followed a structured, component-based UI approach inspired by existing invoice tools and spreadsheet interfaces, ensuring consistency, usability, and alignment with the intended product vision. 

Commitment 

I certify that this submission is my original work, I will actively engage with mentors, commit the required time, and deliver on agreed milestones. 