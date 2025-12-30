import { memo } from "react";

interface Collection {
  _id: string;
  name: string;
}

interface CollectionPillsProps {
  collections: Collection[];
  currentCollection: string;
  onCollectionChange: (collection: string | null) => void;
}

export const CollectionPills = memo(function CollectionPills({
  collections,
  currentCollection,
  onCollectionChange,
}: CollectionPillsProps) {
  if (!collections || collections.length === 0) return null;
  
  return (
    <div className="mb-2 sm:mb-4">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
        {/* All Collections button */}
        <button
          onClick={() => onCollectionChange(null)}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
            !currentCollection
              ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg hover:shadow-xl'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md'
          }`}
        >
          All Collections
        </button>
        
        {/* Individual collection buttons */}
        {collections.map((col) => (
          <button
            key={col._id}
            onClick={() => onCollectionChange(col.name)}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
              currentCollection === col.name
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg hover:shadow-xl'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md'
            }`}
          >
            {col.name}
          </button>
        ))}
      </div>
    </div>
  );
});
