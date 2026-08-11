## 2024-08-10 - React Code Splitting
**Learning:** Implemented route-level code splitting using React.lazy and Suspense. This application has a huge monolith component chunk (~500kb+) as a result of static imports. The chunking improves initial load significantly because now each page acts as a standalone lazy chunk.
**Action:** Always prefer route-level code-splitting with `React.lazy` on medium to large scale SPAs to improve TTI (Time to Interactive).
