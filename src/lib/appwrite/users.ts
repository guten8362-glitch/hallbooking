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

export const getAllUsersFromDatabase = async (): Promise<any[]> => {
  const apiKey = import.meta.env.VITE_APPWRITE_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(`${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.collections.users}/documents?limit=1000`, {
        headers: {
          'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
          'X-Appwrite-Key': apiKey,
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.documents.map((doc: any) => ({
          email: doc.mail_id || doc.email || '',
          name: doc.name || '',
          institution: doc.institution || 'MVIT',
          role: doc.role || 'user',
          fcm_token: doc.fcm_token || null,
          $id: doc.user_id || doc.userId || doc.auth_id || doc.$id,
          docId: doc.$id
        }));
      }
    } catch (err) {
      console.warn('Appwrite: Admin API fallback failed, trying client SDK...', err);
    }
  }

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
      fcm_token: doc.fcm_token || null,
      $id: doc.user_id || doc.userId || doc.auth_id || doc.$id,
      docId: doc.$id
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
        fcm_token: doc.fcm_token || null,
        $id: doc.user_id || doc.userId || doc.auth_id || doc.$id,
        docId: doc.$id
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

    let targetUser: any = null;

    try {
      // 1. Search user in database by mail_id
      let list = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.users,
        [Query.equal('mail_id', normalizedEmail)]
      );

      if (list.documents.length === 0) {
        list = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          [Query.equal('email', normalizedEmail)]
        );
      }
      targetUser = list.documents[0];
    } catch (err) {
      console.warn("Appwrite: listDocuments failed, falling back to getAllUsersFromDatabase", err);
    }
    
    if (!targetUser) {
      const allUsers = await getAllUsersFromDatabase();
      targetUser = allUsers.find(u => 
         (u.email || '').toLowerCase().trim() === normalizedEmail
      );
    }

    if (targetUser) {
      try {
        const apiKey = import.meta.env.VITE_APPWRITE_API_KEY;
        if (apiKey) {
          const allUsers = await getAllUsersFromDatabase();
          const targetDocId = targetUser.$id || targetUser.docId;
          
          // Cleanup other users with the same token
          const otherUsers = allUsers.filter(u => u.fcm_token === token && u.docId !== targetDocId);
          
          for (const ou of otherUsers) {
            if (ou.docId) {
              // Clear token from DB
              fetch(`${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.collections.users}/documents/${ou.docId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
                  'X-Appwrite-Key': apiKey,
                },
                body: JSON.stringify({ data: { fcm_token: null } })
              }).catch(() => {});
            }
            
            // Delete Appwrite Target
            const targetId = `fcm_${ou.$id}_${token.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;
            fetch(`${APPWRITE_CONFIG.endpoint}/users/${ou.$id}/targets/${targetId}`, {
              method: 'DELETE',
              headers: {
                'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
                'X-Appwrite-Key': apiKey,
              }
            }).catch(() => {});
          }

          // Update current user's DB doc with the new token
          if (targetDocId) {
            fetch(`${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.collections.users}/documents/${targetDocId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
                'X-Appwrite-Key': apiKey,
              },
              body: JSON.stringify({ data: { fcm_token: token } })
            }).catch(() => {});
          }
        }

        await registerPushTargetClientSide(token);
        return true;
      } catch (err) {
        console.error('Appwrite: Error updating FCM token securely', err);
        return false;
      }
    }
    return false;
  } catch (error) {
    console.error('Appwrite: Error updating FCM token securely', error);
    return false;
  }
};
