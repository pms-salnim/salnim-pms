#!/bin/bash

# Test script for Availability API Bridge
# This tests the API route forwarding to Supabase Edge Function

# ====================================================================
# Configuration
# ====================================================================

# Replace with your actual property ID (Firebase format: usually firestore doc ID)
PROPERTY_ID="sample-property-123"

# Next.js API endpoint
API_URL="http://localhost:3000/api/property-settings/rates-availability/availability"

# Test 1: Simple single date update
echo "======================================================================"
echo "TEST 1: Single Date Update"
echo "======================================================================"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "'$PROPERTY_ID'",
    "availabilities": [
      {
        "date": "2025-01-15",
        "status": "available",
        "appliedAtLevel": "property"
      }
    ]
  }' | jq .

echo -e "\n"

# Test 2: Date range update (will be expanded by edge function)
echo "======================================================================"
echo "TEST 2: Date Range Update (5-day)"
echo "======================================================================"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "'$PROPERTY_ID'",
    "availabilities": [
      {
        "date": "2025-02-01",
        "endDate": "2025-02-05",
        "status": "available",
        "appliedAtLevel": "property"
      }
    ]
  }' | jq .

echo -e "\n"

# Test 3: Open-ended date (ends 9999-12-31)
echo "======================================================================"
echo "TEST 3: Open-ended Date"
echo "======================================================================"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "'$PROPERTY_ID'",
    "availabilities": [
      {
        "date": "2025-03-01",
        "status": "available",
        "appliedAtLevel": "property"
      }
    ]
  }' | jq .

echo -e "\n"

# Test 4: Multiple updates at once (bulk)
echo "======================================================================"
echo "TEST 4: Bulk Updates (3 different records)"
echo "======================================================================"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "'$PROPERTY_ID'",
    "availabilities": [
      {
        "date": "2025-01-20",
        "status": "available",
        "appliedAtLevel": "property"
      },
      {
        "date": "2025-01-21",
        "endDate": "2025-01-23",
        "status": "blocked",
        "appliedAtLevel": "property"
      },
      {
        "date": "2025-01-25",
        "status": "stop-sell",
        "appliedAtLevel": "property"
      }
    ]
  }' | jq .

echo -e "\n"

# Test 5: Invalid request (missing propertyId)
echo "======================================================================"
echo "TEST 5: Invalid Request (should fail with 400)"
echo "======================================================================"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "availabilities": [
      {
        "date": "2025-01-15",
        "status": "available"
      }
    ]
  }' | jq .

echo -e "\n"

# Test 6: Empty availabilities (should fail with 400)
echo "======================================================================"
echo "TEST 6: Empty Availabilities (should fail with 400)"
echo "======================================================================"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "'$PROPERTY_ID'",
    "availabilities": []
  }' | jq .

echo -e "\n"

echo "======================================================================"
echo "Test suite complete!"
echo "======================================================================"
echo ""
echo "Expected results:"
echo "  TEST 1-4: { success: true, ... } with 200 status"
echo "  TEST 5-6: { error: '...', code: 'INVALID_REQUEST' } with 400 status"
echo ""
echo "To monitor edge function logs:"
echo "  supabase functions logs save-availability"
echo ""
echo "======================================================================"
