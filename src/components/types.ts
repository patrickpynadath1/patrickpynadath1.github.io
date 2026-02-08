export interface ProjectSection {
  title: string;
  content?: string;
  bullets?: string[];
}

export interface ProjectAuthor {
  name: string;
  link?: string;
  isMe?: boolean;
}

export interface ProjectLinks {
  website?: string;
  arxiv?: string;
  github?: string;
}

export interface Project {
  id: string;
  title: string;
  theme: string;
  conference: string;
  emoji: string;
  authors: ProjectAuthor[];
  links: ProjectLinks;
  cats: { left: string; right: string };
  tldr: string;
  sections: ProjectSection[];
}
