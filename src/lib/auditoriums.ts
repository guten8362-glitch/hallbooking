import { listHalls } from './appwrite/database';
import { APPWRITE_CONFIG } from "./appwrite/constants";

export interface Auditorium {
  id: string;
  name: string;
  capacity: number;
  tagline: string;
  availability: string;
  image: string | string[];
  location: string;
  facilities: string[];
  about: string;
}
let cachedAuditoriums: Auditorium[] | null = null;
let fetchPromise: Promise<Auditorium[]> | null = null;

export const fetchAuditoriums = async (force: boolean = false): Promise<Auditorium[]> => {
  if (!force && cachedAuditoriums) return cachedAuditoriums;
  if (!force && fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
    const data = await listHalls();
    if (Array.isArray(data)) {
      return data.map((h: any) => {
        let rawImages = h.imagesURL || h.imageURL || h.image || h.images || [];
        if (typeof rawImages === "string") {
          try { rawImages = JSON.parse(rawImages); } catch { rawImages = [rawImages]; }
        }
        
        const mappedImages = (Array.isArray(rawImages) ? rawImages : [rawImages]).map((img: string) => {
          if (!img) return "";
          if (/^[a-zA-Z0-9]{20}$/.test(img)) {
            return `${APPWRITE_CONFIG.endpoint}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${img}/view?project=${APPWRITE_CONFIG.projectId}`;
          }
          return img;
        }).filter(Boolean);

        return {
          id: h.$id,
          name: h.name || "Unnamed Hall",
          capacity: h.capacity || 0,
          tagline: h.description || h.tagline || "",
          availability: h.availability || "Available Today",
          image: mappedImages,
          location: h.location || "",
          facilities: h.facilities || [],
          about: h.about || h.description || ""
        };
      });
      cachedAuditoriums = mapped;
      return mapped;
    }
  } catch (err) {
    console.error("fetchAuditoriums Appwrite database error:", err);
  }
  return [];
  })();
  
  return fetchPromise;
};

export const fetchAuditorium = async (id: string): Promise<Auditorium | undefined> => {
  const allHalls = await fetchAuditoriums();
  return allHalls.find(h => h.id === id || (h.name || "").toLowerCase().trim() === id.toLowerCase().trim());
};
