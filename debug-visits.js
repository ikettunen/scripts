#!/usr/bin/env node

/**
 * DEBUG VISITS SCRIPT
 * 
 * This script shows what visits exist and what staff IDs they have
 * Run from project root: node scripts/debug-visits.js
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3008/api';
const AUTH_URL = 'http://localhost:3002/api/auth';

// Test credentials
const TEST_CREDENTIALS = {
  email: 'maria.nieminen@hoitokoti.fi',
  password: 'nursing123'
};

async function debugVisits() {
  console.log('🔍 Debugging Visits...');
  
  try {
    // Get auth token
    console.log('Getting auth token...');
    const authResponse = await axios.post(`${AUTH_URL}/login`, TEST_CREDENTIALS);
    const token = authResponse.data.data.token;
    console.log('✅ Authenticated');
    
    // Get all visits
    console.log('\nFetching all visits...');
    const visitsResponse = await axios.get(`${BASE_URL}/visits?limit=20`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const visits = visitsResponse.data.data || [];
    console.log(`Found ${visits.length} visits total`);
    
    if (visits.length === 0) {
      console.log('❌ No visits found! Care-plan-scheduler may not have run.');
      return;
    }
    
    // Show visit details
    console.log('\nVisit Details:');
    console.log('='.repeat(80));
    
    visits.slice(0, 10).forEach((visit, i) => {
      console.log(`${i + 1}. Visit ID: ${visit._id}`);
      console.log(`   Patient: ${visit.patientName}`);
      console.log(`   Nurse ID: ${visit.nurseId || 'NOT SET'}`);
      console.log(`   Nurse Name: ${visit.nurseName || 'NOT SET'}`);
      console.log(`   Status: ${visit.status}`);
      console.log(`   Scheduled: ${visit.scheduledTime}`);
      console.log(`   Tasks: ${visit.taskCompletions?.length || 0}`);
      console.log('');
    });
    
    // Show unique staff IDs
    const staffIds = [...new Set(visits.map(v => v.nurseId).filter(id => id))];
    console.log('Unique Staff IDs in visits:');
    staffIds.forEach(id => console.log(`  - ${id}`));
    
    // Check for S1001 specifically
    const s1001Visits = visits.filter(v => v.nurseId === 'S1001');
    console.log(`\nVisits assigned to S1001: ${s1001Visits.length}`);
    
    if (s1001Visits.length > 0) {
      console.log('✅ S1001 visits found - test should work');
    } else {
      console.log('❌ No S1001 visits - test will fail');
      console.log('Care-plan-scheduler may be assigning different staff IDs');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

debugVisits();