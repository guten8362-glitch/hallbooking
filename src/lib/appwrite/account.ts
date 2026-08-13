import { ID, OAuthProvider, Query } from 'appwrite';
import { account, databases, teams, functions } from './client';
import { APPWRITE_CONFIG } from './constants';

export const loginWithGoogle = () => {
  account.createOAuth2Session(
    OAuthProvider.Google,
    `${window.location.origin}/auditoriums`, // Success URL
    `${window.location.origin}/login?error=true` // Failure URL
  );
};

export const loginWithMagicLink = async (email: string) => {
  try {
    try {
      await account.deleteSession('current');
    } catch {
      // No active session to delete
    }
    const session = await account.createMagicURLToken(
      ID.unique(),
      email,
      `${window.location.origin}/login`
    );
    return session;
  } catch (error: any) {
    console.error('Appwrite: Magic Link error:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await account.deleteSession('current');
    return true;
  } catch (error) {
    console.error('Appwrite: Error logging out', error);
    return false;
  }
};

export const getCurrentSession = async () => {
  try {
    const session = await account.getSession('current');
    return session;
  } catch (error) {
    return null; // Not logged in
  }
};

export const getCurrentUser = async () => {
  try {
    const user = await account.get();
    
    try {
      const functionId = import.meta.env.VITE_LOGIN_FUNCTION_ID || "6727282a003cf54291dc";
      const response = await functions.createExecution(
        functionId,
        JSON.stringify({ email: user.email }),
        false,
        '/',
        'POST'
      );
      
      if (response.status === 'failed') {
        throw new Error("Failed to verify user profile with backend");
      }
      
      const userDoc = JSON.parse(response.responseBody);
      
      if (userDoc.error || !userDoc.authorized) {
        console.warn(`User ${user.email} not found in the users database table. Access denied.`);
        await account.deleteSession('current');
        if (typeof window !== 'undefined' && !window.location.href.includes('error=unauthorized')) {
          window.location.href = '/login?error=unauthorized';
        }
        return null;
      }
      
      let teamName = "external_user";
      let userTeams: any = null;
      try {
        userTeams = await teams.list();
        if (userTeams.teams.some(t => t.name === 'mvit_user')) {
          teamName = "mvit_user";
        } else if (userTeams.teams.some(t => t.name === 'external_user')) {
          teamName = "external_user";
        }
      } catch (teamErr) {
        console.error("Error fetching teams:", teamErr);
      }

      let rawRole = (userDoc.role || 'user').toString().toLowerCase().trim();
      let role = rawRole;

      if (rawRole === 'coordinator' || teamName === 'coordinator' || (userTeams && userTeams.teams.some(t => t.name.toLowerCase() === 'coordinator'))) {
        role = 'coordinator';
      } else if (rawRole === 'admin') {
        role = 'admin';
      }

      return {
        email: user.email,
        name: userDoc.name || user.name || user.email.split('@')[0],
        role: role as "user" | "admin" | "coordinator" | "organizer",
        institution: userDoc.institution || 'MVIT',
        team: teamName,
        $id: user.$id
      };
    } catch (e) {
      console.error("Error reading users table:", e);
      await account.deleteSession('current');
      if (typeof window !== 'undefined' && !window.location.href.includes('error=unauthorized')) {
        window.location.href = '/login?error=unauthorized';
      }
      return null;
    }
  } catch (error) {
    return null;
  }
};
