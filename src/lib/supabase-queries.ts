import { createClient } from "@/utils/supabase/client";
import type { Reservation, Room } from "@/types";

const supabase = createClient();

// ===== RESERVATIONS =====
export async function fetchReservations(propertyId: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reservations:", error);
    throw error;
  }
  return data;
}

export async function fetchReservationById(reservationId: string) {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .single();

  if (error) {
    console.error("Error fetching reservation:", error);
    throw error;
  }
  return data;
}

export async function createReservation(
  propertyId: string,
  reservationData: Partial<Reservation>
) {
  const { data, error } = await supabase
    .from("reservations")
    .insert([
      {
        property_id: propertyId,
        ...reservationData,
      },
    ])
    .select();

  if (error) {
    console.error("Error creating reservation:", error);
    throw error;
  }
  return data[0];
}

export async function updateReservation(
  reservationId: string,
  updates: Partial<Reservation>
) {
  const { data, error } = await supabase
    .from("reservations")
    .update(updates)
    .eq("id", reservationId)
    .select();

  if (error) {
    console.error("Error updating reservation:", error);
    throw error;
  }
  return data[0];
}

export async function deleteReservation(reservationId: string) {
  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", reservationId);

  if (error) {
    console.error("Error deleting reservation:", error);
    throw error;
  }
}

// ===== ROOMS =====
export async function fetchRooms(propertyId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("property_id", propertyId);

  if (error) {
    console.error("Error fetching rooms:", error);
    throw error;
  }
  return data;
}

export async function fetchRoomById(roomId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (error) {
    console.error("Error fetching room:", error);
    throw error;
  }
  return data;
}

export async function updateRoom(roomId: string, updates: Partial<Room>) {
  const { data, error } = await supabase
    .from("rooms")
    .update(updates)
    .eq("id", roomId)
    .select();

  if (error) {
    console.error("Error updating room:", error);
    throw error;
  }
  return data[0];
}

export async function createRoom(propertyId: string, roomData: Partial<Room>) {
  const { data, error } = await supabase
    .from("rooms")
    .insert([
      {
        property_id: propertyId,
        ...roomData,
      },
    ])
    .select();

  if (error) {
    console.error("Error creating room:", error);
    throw error;
  }
  return data[0];
}

// ===== ROOM TYPES =====
export async function fetchRoomTypes(propertyId: string) {
  const { data, error } = await supabase
    .from("room_types")
    .select("*")
    .eq("property_id", propertyId);

  if (error) {
    console.error("Error fetching room types:", error);
    throw error;
  }
  return data;
}

// ===== GUESTS =====
export async function fetchGuests(propertyId: string) {
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching guests:", error);
    throw error;
  }
  return data;
}

export async function createGuest(
  propertyId: string,
  guestData: Partial<any>
) {
  const { data, error } = await supabase
    .from("guests")
    .insert([
      {
        property_id: propertyId,
        ...guestData,
      },
    ])
    .select();

  if (error) {
    console.error("Error creating guest:", error);
    throw error;
  }
  return data[0];
}

// ===== PROPERTIES =====
export async function fetchProperty(propertyId: string) {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (error) {
    console.error("Error fetching property:", error);
    throw error;
  }
  return data;
}

export async function updateProperty(propertyId: string, updates: any) {
  const { data, error } = await supabase
    .from("properties")
    .update(updates)
    .eq("id", propertyId)
    .select();

  if (error) {
    console.error("Error updating property:", error);
    throw error;
  }
  return data[0];
}

// ===== TASKS =====
export async function fetchTasks(propertyId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }
  return data;
}

export async function createTask(propertyId: string, taskData: any) {
  const { data, error } = await supabase
    .from("tasks")
    .insert([
      {
        property_id: propertyId,
        ...taskData,
      },
    ])
    .select();

  if (error) {
    console.error("Error creating task:", error);
    throw error;
  }
  return data[0];
}

export async function updateTask(taskId: string, updates: any) {
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .select();

  if (error) {
    console.error("Error updating task:", error);
    throw error;
  }
  return data[0];
}

// ===== REAL-TIME SUBSCRIPTIONS =====
export function subscribeToReservations(
  propertyId: string,
  callback: (payload: any) => void
) {
  const subscription = supabase
    .from(`reservations:property_id=eq.${propertyId}`)
    .on("*", (payload: any) => {
      callback(payload);
    })
    .subscribe();

  return subscription;
}

export function subscribeToRooms(
  propertyId: string,
  callback: (payload: any) => void
) {
  const subscription = supabase
    .from(`rooms:property_id=eq.${propertyId}`)
    .on("*", (payload: any) => {
      callback(payload);
    })
    .subscribe();

  return subscription;
}
