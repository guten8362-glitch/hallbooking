import { ID, Query } from 'appwrite';
import { account, databases } from './client';
import { APPWRITE_CONFIG } from './constants';

export const listBookings = async (customQueries: string[] = []) => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.bookings,
      [Query.orderDesc('$createdAt'), Query.limit(500), ...customQueries]
    );
    return response.documents;
  } catch (error) {
    console.warn('Appwrite: First attempt fetching bookings failed, attempting session recovery:', error);
    try {
      await account.createAnonymousSession();
      const retryResponse = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.bookings,
        [Query.orderDesc('$createdAt'), Query.limit(500), ...customQueries]
      );
      return retryResponse.documents;
    } catch (retryError) {
      console.error('Appwrite: Error fetching bookings after recovery:', retryError);
      throw retryError;
    }
  }
};

const mapToBackend = (b: any) => {
  const payload: any = {};
  if (b.auditoriumId !== undefined) payload.hallId = b.auditoriumId;
  if (b.institution !== undefined) payload.collegeId = b.institution;
  if (b.department !== undefined) payload.department = b.department;
  if (b.coordinator !== undefined) payload.coordinatorName = b.coordinator;
  if (b.eventName !== undefined) payload.eventName = b.eventName;
  if (b.purpose !== undefined) payload.eventDescription = b.purpose;
  if (b.participants !== undefined) payload.expectedAudience = Number(b.participants) || 0;
  
  if (b.stage === 'confirmed') payload.status = 'confirm';
  else if (b.stage === 'pending_coordinator') payload.status = 'forwarded';
  else if (b.stage === 'pending_super_admin') payload.status = 'pending';
  else if (b.stage === 'rejected') payload.status = 'rejected';
  else if (b.stage !== undefined) payload.status = 'pending';

  if (b.approvedBy !== undefined) payload.approvedBy = b.approvedBy;

  if (b.selectedDates && b.selectedDates.length > 0) {
    try { payload.eventDate = new Date(b.selectedDates[0]).toISOString(); } catch {}
  } else if (b.fromDate) {
    try { payload.eventDate = new Date(b.fromDate).toISOString(); } catch {}
  } else {
    payload.eventDate = new Date().toISOString();
  }
  payload.startTime = payload.eventDate;
  payload.endTime = payload.eventDate;

  payload.remarks = JSON.stringify({
    stage: b.stage,
    date: b.date,
    fromDate: b.fromDate,
    toDate: b.toDate,
    selectedDates: b.selectedDates,
    startTimeStr: b.startTime,
    endTimeStr: b.endTime,
    daisChairs: b.daisChairs,
    organizerNotes: b.organizerNotes,
    facilitiesRequired: b.facilitiesRequired,
    rejectionCategory: b.rejectionCategory,
    rejectionReason: b.rejectionReason,
    requesterId: b.requesterId, // Save the requester's ID
    remarks: b.remarks // Include actual user remarks so it can be parsed back out
  });
  return payload;
};

export const createBooking = async (bookingData: any) => {
  try {
    const payload = mapToBackend(bookingData);
    const response = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.bookings,
      bookingData.id || ID.unique(),
      payload
    );
    return response;
  } catch (error) {
    console.error('Appwrite: Error creating booking', error);
    throw error;
  }
};

export const updateBooking = async (id: string, updateData: any) => {
  try {
    const payload = mapToBackend(updateData);
    // don't overwrite eventDate if not provided in updateData
    if (!updateData.fromDate && !updateData.date) {
        delete payload.eventDate;
        delete payload.startTime;
        delete payload.endTime;
    }
    const response = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.bookings,
      id,
      payload
    );
    return response;
  } catch (error) {
    console.error('Appwrite: Error updating booking', error);
    throw error;
  }
};

export const deleteBooking = async (id: string) => {
  try {
    await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.bookings,
      id
    );
    return true;
  } catch (error) {
    console.error('Appwrite: Error deleting booking', error);
    throw error;
  }
};

export const listHalls = async () => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.halls
    );
    return response.documents;
  } catch (error) {
    console.warn('Appwrite: First attempt fetching halls failed, attempting session recovery:', error);
    try {
      await account.createAnonymousSession();
      const retryResponse = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.halls
      );
      return retryResponse.documents;
    } catch (retryError) {
      console.error('Appwrite: Error fetching halls after recovery:', retryError);
      throw retryError;
    }
  }
};

export const createNotification = async (data: { userId?: string, title: string, message: string, bookingId?: string, type: string }) => {
  if (!APPWRITE_CONFIG.collections.notifications) return;
  try {
    return await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.notifications,
      ID.unique(),
      data
    );
  } catch (error) {
    console.warn('Appwrite: Error creating notification, attempting session recovery:', error);
    try {
      await account.createAnonymousSession();
      return await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.notifications,
        ID.unique(),
        data
      );
    } catch (retryErr) {
      console.error('Appwrite: Could not create notification document:', retryErr);
    }
  }
};

export const listNotifications = async () => {
  if (!APPWRITE_CONFIG.collections.notifications) return [];
  try {
    const response = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.notifications,
      [Query.orderDesc('$createdAt')]
    );
    return response.documents;
  } catch (error) {
    console.warn('Appwrite: Error fetching notifications, attempting session recovery:', error);
    try {
      await account.createAnonymousSession();
      const retryResponse = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.notifications,
        [Query.orderDesc('$createdAt')]
      );
      return retryResponse.documents;
    } catch (retryErr) {
      console.error('Appwrite: Could not list notifications:', retryErr);
      return [];
    }
  }
};
