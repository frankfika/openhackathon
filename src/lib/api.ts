import axios from 'axios'
import { Hackathon, Project, Assignment } from './mock-data'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const api = {
  getHackathons: async () => {
    const res = await axios.get<Hackathon[]>(`${API_URL}/hackathons`)
    return res.data
  },
  createHackathon: async (data: Partial<Hackathon>) => {
    const res = await axios.post<Hackathon>(`${API_URL}/hackathons`, data)
    return res.data
  },
  updateHackathon: async (id: string, data: Partial<Hackathon>) => {
    const res = await axios.put<Hackathon>(`${API_URL}/hackathons/${id}`, data)
    return res.data
  },
  getProjects: async (hackathonId?: string) => {
    const res = await axios.get<Project[]>(`${API_URL}/projects`, { params: { hackathonId } })
    return res.data
  },
  createProject: async (data: Partial<Project>) => {
    const res = await axios.post<Project>(`${API_URL}/projects`, data)
    return res.data
  },
  getAssignments: async () => {
    const res = await axios.get<Assignment[]>(`${API_URL}/assignments`)
    return res.data
  }
}
