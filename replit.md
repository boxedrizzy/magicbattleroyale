# Node.js Project

## Overview

This is a basic Node.js project setup with a simple HTTP server. The project is ready for development and can be extended with additional features as needed.

## System Architecture

The application follows a simple server architecture:

- **Backend**: Node.js with built-in HTTP module for web server
- **Static Files**: Simple HTML responses served directly from the server

## Key Components

### Server Components
- **HTTP Server**: Basic Node.js HTTP server handling requests and responses
- **Port Configuration**: Configurable port with fallback to 5000

## External Dependencies

### Core Dependencies
- **Node.js**: JavaScript runtime environment
- **Built-in HTTP Module**: Native Node.js HTTP functionality

## Deployment Strategy

### Environment Configuration
- **PORT**: Environment variable for port configuration (defaults to 5000)
- **Static Responses**: Simple HTML responses for basic functionality

### Production Readiness Features
- Configurable port binding
- Host binding to 0.0.0.0 for accessibility

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

- July 01, 2025: Enhanced visual broadcasting system for wizard battle royale game
  - Added comprehensive spell animation broadcasting with particle effects, trails, and impact data
  - Implemented transformation effect broadcasting with particles, auras, and visual feedback
  - Enhanced special attack broadcasting with shockwaves, screen shake, and advanced effects
  - Added damage effect broadcasting with spell-specific impacts and status effects
  - Implemented death effect broadcasting with spell-specific death animations
  - Added level up effect broadcasting with visual celebrations
  - Created skill effect broadcasting for all transformation abilities
  - Enhanced healing and status effect broadcasting
  - Added comprehensive helper functions for all visual effect calculations
  - Integrated PostgreSQL database with Drizzle ORM for persistent data storage
  - Added database schema for players, spells, transformations, and game sessions
  - Enhanced spell impact effects with level-based scaling for all magic types
  - Added environment interaction effects for all spell types
  - Implemented special effects for ultimate spells (Apocalypse Fire, God's Wrath, etc.)
  - Added healing wave effect broadcasting with particle systems
  - Implemented status effect broadcasting (burn, freeze, poison, blind, regeneration)
  - Enhanced all magic types broadcasting: fire, ice, lightning, earth, wind, shadow, light, void, soul
  - All visual effects now synchronize across all connected players in real-time