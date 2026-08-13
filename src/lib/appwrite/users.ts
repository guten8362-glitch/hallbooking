import { ID, Query } from 'appwrite';
import { account, databases } from './client';
import { APPWRITE_CONFIG } from './constants';
import type { UserRole, User } from '../auth';

export const addUserToDatabase = async (newUser: {
  email: string;
  password?: string;
  name: string;
  institution: string;
  role: UserRole;
}) => {
  try {
    const userDoc = {
      mail_id: newUser.email,
      name: newUser.name,
      institution: newUser.institution,
      role: newUser.role,
    };
    
    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      ID.unique(),
      userDoc
    );
    return true;
  } catch (error) {
    console.error('Appwrite: Error adding user to database', error);
    return false;
  }
};

export const getAllUsersFromDatabase = async (): Promise<User[]> => {
  try {
    const response = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.users,
      [Query.limit(1000)]
    );
    return response.documents.map((doc: any) => ({
      email: doc.mail_id || doc.email || '',
      name: doc.name || '',
      institution: doc.institution || 'MVIT',
      role: doc.role || 'user',
      $id: doc.user_id || doc.userId || doc.auth_id || doc.$id
    }));
  } catch (error) {
    console.warn('Appwrite: Error fetching users, attempting session recovery:', error);
    try {
      await account.createAnonymousSession();
      const retryResponse = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.users,
        [Query.limit(1000)]
      );
      return retryResponse.documents.map((doc: any) => ({
        email: doc.mail_id || doc.email || '',
        name: doc.name || '',
        institution: doc.institution || 'MVIT',
        role: doc.role || 'user',
        $id: doc.user_id || doc.userId || doc.auth_id || doc.$id
      }));
    } catch (retryErr) {
      console.error('Appwrite: Error fetching users after recovery:', retryErr);
      return [];
    }
  }
};

export const registerPushTargetClientSide = async (token: string) => {
  if (!token) return false;

  try {
    const user = await account.get();
    const targetId = `fcm_${user.$id}_${token.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;
    const PROVIDER_ID = '6a6c0163000e309089af'; // Must match FCM provider ID in Appwrite Console

    try {
      await account.createPushTarget(targetId, token, PROVIDER_ID);
      console.log('Appwrite: Successfully registered Push Target securely via Client SDK!');
      return true;
    } catch (createErr: any) {
      if (createErr.code === 409) {
        // Target already exists
        return true;
      }
      console.error('Appwrite: Client Push Target creation error:', createErr);
    }
  } catch (err) {
    console.error('Appwrite: Exception registering Push Target on Client:', err);
  }
  return false;
};

export const updateUserFCMToken = async (email: string, token: string, userAuthId?: string) => {
  try {
    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) return false;

    // Securely register the token in Appwrite Auth natively.
    // We intentionally DO NOT save this token to the public `users` database table
    // to prevent sensitive token leaks in the Network tab.
    await registerPushTargetClientSide(token);
    
    return true;
  } catch (error) {
    console.error('Appwrite: Error updating FCM token securely', error);
    return false;
  }
};
