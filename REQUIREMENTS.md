# QR-Based Cafeteria Ordering System with AI Chatbot
## Software Requirements Specification (SRS)

---

# 1. Project Overview

## 1.1 Project Title
CampusBite | QR-Based Cafeteria Ordering System with AI Assistant

---

## 1.2 Project Description

The QR-Based Cafeteria Ordering System is a web-based smart cafeteria management platform designed for university campuses. Students can scan QR codes placed on cafeteria tables to browse menus, place orders, track order status in real time, and interact with an AI chatbot assistant for food recommendations, availability information, and support.

The system also includes kitchen and admin dashboards for efficient order handling, menu management, and sales monitoring.

---

# 2. Objectives

- Reduce cafeteria waiting time
- Enable contactless ordering
- Improve order management efficiency
- Provide smart food recommendations using AI
- Digitize campus cafeteria operations

---

# 3. Scope of the Project

The system will support:

- QR-based table access
- Digital menu browsing
- Digital food ordering
- Realtime order tracking
- AI chatbot assistance
- Admin QR code management
- Kitchen order management
- Admin analytics dashboard

The project is intended for educational and demonstration purposes.

---

# 4. Users of the System

## 4.1 Student / Customer
Can:
- Scan QR codes
- View menu
- Place orders
- Track order status
- Chat with AI assistant

---

## 4.2 Kitchen Staff
Can:
- View incoming orders
- Update order status
- Manage order queue

---

## 4.3 Administrator
Can:
- Manage menu items
- Manage tables
- View analytics
- Manage staff accounts
- Monitor orders

---

# 5. Functional Requirements

# 5.1 Authentication Module

## Features
- passwordless user login and registration using email or phone number
- Role-based authentication for admin and kitchen staff
- Secure session management

---

# 5.2 QR Table Module

## Features
- Unique QR code generation for each table
- QR redirects customer to table-specific page
- Automatic table identification

Example:
```txt
/table/5
```
- QR code management interface for admins
- QR code generation and printing functionality
- QR code status tracking (active/inactive)
- QR code analytics (usage statistics)
- QR code error handling (invalid/expired codes)

---
# 5.3 Menu Management Module
## Features
- Admin interface for adding, editing, and deleting menu items
- Menu item details (name, description, price, image)
- Menu categorization (appetizers, main courses, desserts, beverages)
- Menu availability management (in stock/out of stock)
- Menu item search and filter functionality
- Menu item analytics (popularity, sales data)
- Menu item error handling (invalid input, duplicate items)
---

# 5.4 Ordering Module
## Features
- Customer order placement interface
- Order customization options (quantity, special instructions)
- Order summary and confirmation
- Realtime order status updates (received, preparing, ready for pickup)
- Order history for customers
- Order management interface for kitchen staff
- Order prioritization and queue management for kitchen staff
- Order analytics (average preparation time, popular items)
- Order error handling (invalid orders, payment issues)
---

# 5.5 AI Chatbot Module
## Features
- Natural language processing for customer queries
- Food recommendations based on customer preferences and order history
- Menu item availability information
- Order assistance and troubleshooting
- Multilingual support
- AI chatbot analytics (common queries, customer satisfaction)
- AI chatbot error handling (unrecognized queries, system errors)
- Use Gemini API for AI chatbot functionality
---

# 5.6 Analytics Dashboard Module
## Features
- Sales analytics (total sales, sales by item/category)
- Customer analytics (number of customers, repeat customers)
- Order analytics (average order value, order frequency)
- QR code analytics (usage statistics, table popularity)
- Real-time monitoring of orders and customer interactions
- Customizable reports and data export functionality
- Analytics dashboard access control for admins
- Analytics dashboard error handling (data retrieval issues, display errors)

---

# 6. Non-Functional Requirements
## 6.1 Performance
- The system should handle up to 100 concurrent users without performance degradation.
- Order processing time should not exceed 2 seconds.
## 6.2 Security
- All user data should be encrypted in transit and at rest.
- Implement role-based access control for admin and kitchen staff.
- Regular security audits and vulnerability assessments.
## 6.3 Usability
- The user interface should be intuitive and easy to navigate for all user roles.
- Provide clear instructions and feedback for user actions.
## 6.4 Scalability
- The system should be designed to accommodate future growth in user base and features.
- Use scalable cloud infrastructure for hosting and data storage.
## 6.5 Reliability
- The system should have an uptime of 99.9%.




