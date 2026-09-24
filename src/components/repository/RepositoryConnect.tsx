import { useState, useRef } from 'react';
import { Upload, GitBranch, ArrowRight, FileCode2 } from 'lucide-react';
import { ExynoxLogo } from '../layout/ExynoxLogo.js';

interface RepositoryConnectProps {
  onConnectZip: (file: File) => void;
  onConnectGitHub: (url: string) => void;
  onConnectSample: () => void;
  isLoading: boolean;
}

export function RepositoryConnect({
  onConnectZip,
  onConnectGitHub,
  onConnectSample,
  isLoading
}: RepositoryConnectProps) {
  const [showGithubInput, setShowGithubInput] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onConnectZip(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onConnectZip(e.dataTransfer.files[0]);
    }
  };

  const handleGitHubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (githubUrl.trim()) {
      onConnectGitHub(githubUrl.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-4">
      {/* Brand anchor for landing screen */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="mb-3">
          <ExynoxLogo size="lg" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
          ExynoX Code Intelligence
        </h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-md">
          Ask your codebase anything.
        </p>
      </div>

      {/* Main Connection Card */}
      <div 
        id="repository-connect-card"
        className={`bg-[#111622] rounded-xl border transition-all duration-200 p-6 sm:p-8 ${
          dragActive 
            ? 'border-cyan-500 bg-cyan-950/10' 
            : 'border-zinc-800/80 hover:border-zinc-700/80'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".zip"
          className="hidden"
          onChange={handleFileChange}
          id="zip-file-upload-input"
        />

        <div className="space-y-4">
          {/* Primary Option: Upload Repository */}
          <button
            type="button"
            id="btn-upload-zip"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/60 hover:border-cyan-500/50 text-left transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-md bg-zinc-900 border border-zinc-700/60 text-cyan-400 group-hover:text-cyan-300">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-zinc-200 text-sm group-hover:text-zinc-100">
                  Upload Repository
                </div>
                <div className="text-xs text-zinc-400">
                  Upload a compressed repository archive (.zip)
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover:text-cyan-400 flex items-center gap-1">
              Select archive <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>

          {/* Secondary Option: GitHub Repository */}
          {!showGithubInput ? (
            <button
              type="button"
              id="btn-github-repo-toggle"
              onClick={() => setShowGithubInput(true)}
              disabled={isLoading}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-left transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-zinc-200">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-zinc-300 text-sm group-hover:text-zinc-200">
                    GitHub Repository
                  </div>
                  <div className="text-xs text-zinc-500">
                    Connect via public GitHub repository URL
                  </div>
                </div>
              </div>
              <span className="text-xs text-zinc-500 group-hover:text-zinc-400">
                Connect URL
              </span>
            </button>
          ) : (
            <form onSubmit={handleGitHubSubmit} className="p-4 rounded-lg bg-zinc-900/90 border border-zinc-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="github-url-input" className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                  GitHub Repository URL
                </label>
                <button
                  type="button"
                  onClick={() => setShowGithubInput(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  id="github-url-input"
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/organization/repo"
                  className="flex-1 px-3 py-2 bg-zinc-950 rounded-md border border-zinc-700 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  autoFocus
                />
                <button
                  type="submit"
                  id="btn-connect-github-submit"
                  disabled={!githubUrl.trim() || isLoading}
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-md text-xs font-medium transition-colors cursor-pointer"
                >
                  Connect
                </button>
              </div>
            </form>
          )}

          {/* Tertiary Option: Try Sample Repository */}
          <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              Want to try ExynoX immediately?
            </span>
            <button
              type="button"
              id="btn-load-sample-repo"
              onClick={onConnectSample}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-md bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-800/50 text-xs text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 cursor-pointer font-medium transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Try Sample Repository</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
