import { atom } from 'nanostores';

export const userStore = atom(null);
export const projectStore = atom([]);
export const currentProjectStore = atom(null);

export const setUser = (user) => {
  userStore.set(user);
};

export const addProject = (project) => {
  projectStore.set([...projectStore.get(), project]);
};

export const setCurrentProject = (project) => {
  currentProjectStore.set(project);
};