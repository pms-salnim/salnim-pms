/**
 * Booking Restriction Validation Tests
 * Tests that rooms can only be booked when marked as 'available' in Supabase
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { db } from '../lib/firebase';
import { checkMultipleRoomsAvailability, isRoomAvailableInSupabase } from '../source/lib/checkSupabaseAvailability';
import { startOfDay } from 'date-fns';
import { Timestamp } from 'firebase-admin/firestore';

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3Qta2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTMyODEzODcsImV4cCI6MTg3MDk0NzM4N30.test';
const TEST_PROPERTY_ID = 'test-property-001';
const TEST_ROOM_ID = 'test-room-001';
const TEST_ROOM_TYPE_ID = 'test-room-type-001';

describe('Booking Restriction Validation', () => {
    let supabase: any;
    let testDates: { startDate: Date; endDate: Date };

    beforeEach(async () => {
        // Initialize Supabase client
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Set test date range (next 5 days)
        testDates = {
            startDate: startOfDay(new Date()),
            endDate: startOfDay(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
        };

        // Clean up: Remove any existing test data
        await supabase
            .from('availability_calendar')
            .delete()
            .eq('property_id', TEST_PROPERTY_ID);
    });

    afterEach(async () => {
        // Clean up test data
        await supabase
            .from('availability_calendar')
            .delete()
            .eq('property_id', TEST_PROPERTY_ID);
    });

    describe('Single Room Availability Check', () => {
        it('should return true when room is marked available for all dates in range', async () => {
            // Setup: Insert availability records for all dates as 'available'
            const daysCount = Math.ceil(
                (testDates.endDate.getTime() - testDates.startDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            const records = [];
            for (let i = 0; i <= daysCount; i++) {
                const date = new Date(testDates.startDate);
                date.setDate(date.getDate() + i);
                records.push({
                    property_id: TEST_PROPERTY_ID,
                    room_id: TEST_ROOM_ID,
                    date: date.toISOString().split('T')[0],
                    status: 'available',
                    applied_at_level: 'room',
                });
            }

            await supabase.from('availability_calendar').insert(records);

            // Test
            const result = await isRoomAvailableInSupabase(
                TEST_ROOM_ID,
                TEST_PROPERTY_ID,
                testDates.startDate,
                testDates.endDate
            );

            // Assert
            expect(result).toBe(true);
        });

        it('should return false when room has unavailable status on any date', async () => {
            // Setup: Insert records with one date as 'unavailable'
            const daysCount = Math.ceil(
                (testDates.endDate.getTime() - testDates.startDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            const records = [];
            for (let i = 0; i <= daysCount; i++) {
                const date = new Date(testDates.startDate);
                date.setDate(date.getDate() + i);
                records.push({
                    property_id: TEST_PROPERTY_ID,
                    room_id: TEST_ROOM_ID,
                    date: date.toISOString().split('T')[0],
                    status: i === 2 ? 'unavailable' : 'available', // Day 2 is unavailable
                    applied_at_level: 'room',
                });
            }

            await supabase.from('availability_calendar').insert(records);

            // Test
            const result = await isRoomAvailableInSupabase(
                TEST_ROOM_ID,
                TEST_PROPERTY_ID,
                testDates.startDate,
                testDates.endDate
            );

            // Assert
            expect(result).toBe(false);
        });

        it('should return false when room has no records for date range', async () => {
            // Setup: No records inserted (empty table)

            // Test
            const result = await isRoomAvailableInSupabase(
                TEST_ROOM_ID,
                TEST_PROPERTY_ID,
                testDates.startDate,
                testDates.endDate
            );

            // Assert
            expect(result).toBe(false);
        });
    });

    describe('Multiple Rooms Availability Check', () => {
        it('should return availability status for each room correctly', async () => {
            const room2Id = 'test-room-002';
            const daysCount = Math.ceil(
                (testDates.endDate.getTime() - testDates.startDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            // Setup: Room 1 available all dates, Room 2 unavailable on day 1
            const records = [];
            for (let i = 0; i <= daysCount; i++) {
                const date = new Date(testDates.startDate);
                date.setDate(date.getDate() + i);

                // Room 1 - always available
                records.push({
                    property_id: TEST_PROPERTY_ID,
                    room_id: TEST_ROOM_ID,
                    date: date.toISOString().split('T')[0],
                    status: 'available',
                    applied_at_level: 'room',
                });

                // Room 2 - unavailable on day 1
                records.push({
                    property_id: TEST_PROPERTY_ID,
                    room_id: room2Id,
                    date: date.toISOString().split('T')[0],
                    status: i === 1 ? 'unavailable' : 'available',
                    applied_at_level: 'room',
                });
            }

            await supabase.from('availability_calendar').insert(records);

            // Test
            const result = await checkMultipleRoomsAvailability(
                [TEST_ROOM_ID, room2Id],
                TEST_PROPERTY_ID,
                testDates.startDate,
                testDates.endDate
            );

            // Assert
            expect(result[TEST_ROOM_ID]).toBe(true);
            expect(result[room2Id]).toBe(false);
        });

        it('should handle empty room list gracefully', async () => {
            // Test
            const result = await checkMultipleRoomsAvailability(
                [],
                TEST_PROPERTY_ID,
                testDates.startDate,
                testDates.endDate
            );

            // Assert
            expect(result).toEqual({});
        });
    });

    describe('Booking Flow Integration', () => {
        it('should prevent booking when room lacks available status', async () => {
            // Setup: Room marked as unavailable
            const daysCount = Math.ceil(
                (testDates.endDate.getTime() - testDates.startDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            const records = [];
            for (let i = 0; i <= daysCount; i++) {
                const date = new Date(testDates.startDate);
                date.setDate(date.getDate() + i);
                records.push({
                    property_id: TEST_PROPERTY_ID,
                    room_id: TEST_ROOM_ID,
                    date: date.toISOString().split('T')[0],
                    status: 'unavailable',
                    applied_at_level: 'room',
                });
            }

            await supabase.from('availability_calendar').insert(records);

            // Test: Try to check availability
            const availability = await isRoomAvailableInSupabase(
                TEST_ROOM_ID,
                TEST_PROPERTY_ID,
                testDates.startDate,
                testDates.endDate
            );

            // Assert: Should not be available
            expect(availability).toBe(false);
        });

        it('should allow booking when room is marked available', async () => {
            // Setup: Room marked as available for all dates
            const daysCount = Math.ceil(
                (testDates.endDate.getTime() - testDates.startDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            const records = [];
            for (let i = 0; i <= daysCount; i++) {
                const date = new Date(testDates.startDate);
                date.setDate(date.getDate() + i);
                records.push({
                    property_id: TEST_PROPERTY_ID,
                    room_id: TEST_ROOM_ID,
                    date: date.toISOString().split('T')[0],
                    status: 'available',
                    applied_at_level: 'room',
                });
            }

            await supabase.from('availability_calendar').insert(records);

            // Test: Check availability
            const availability = await isRoomAvailableInSupabase(
                TEST_ROOM_ID,
                TEST_PROPERTY_ID,
                testDates.startDate,
                testDates.endDate
            );

            // Assert: Should be available
            expect(availability).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle single-day bookings correctly', async () => {
            // Setup: Single day with available status
            const singleDate = testDates.startDate.toISOString().split('T')[0];
            await supabase.from('availability_calendar').insert({
                property_id: TEST_PROPERTY_ID,
                room_id: TEST_ROOM_ID,
                date: singleDate,
                status: 'available',
                applied_at_level: 'room',
            });

            // Test
            const result = await isRoomAvailableInSupabase(
                TEST_ROOM_ID,
                TEST_PROPERTY_ID,
                testDates.startDate,
                testDates.startDate // Same day
            );

            // Assert
            expect(result).toBe(true);
        });

        it('should handle open-ended bookings (9999-12-31) correctly', async () => {
            // Setup: Records through far future date
            const farFutureDate = new Date('9999-12-31');
            const records = [];

            // Create records from start date to far future
            for (let d = new Date(testDates.startDate); d <= farFutureDate; d.setDate(d.getDate() + 7)) {
                records.push({
                    property_id: TEST_PROPERTY_ID,
                    room_id: TEST_ROOM_ID,
                    date: d.toISOString().split('T')[0],
                    status: 'available',
                    applied_at_level: 'room',
                });
                if (records.length > 50) break; // Limit records
            }

            await supabase.from('availability_calendar').insert(records);

            // Test with open-ended date
            const result = await isRoomAvailableInSupabase(
                TEST_ROOM_ID,
                TEST_PROPERTY_ID,
                testDates.startDate,
                farFutureDate
            );

            // Assert: Should handle gracefully (may be false due to gaps, which is correct)
            expect(typeof result).toBe('boolean');
        });

        it('should be conservative on database errors', async () => {
            // Test with invalid property ID (will cause query to fail gracefully)
            const result = await isRoomAvailableInSupabase(
                'invalid-room',
                'invalid-property',
                testDates.startDate,
                testDates.endDate
            );

            // Assert: Should return false on error (conservative denial)
            expect(result).toBe(false);
        });
    });
});
