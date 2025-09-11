import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);

      const { data, error } = await supabase.auth.admin.listUsers();

      if (error) {
        console.error("Error fetching users:", error.message);
        setUsers([]);
      } else {
        setUsers(data?.users || []);
      }

      setLoading(false);
    };

    fetchUsers();
  }, []);

  if (loading) return <p>Loading users...</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">User List</h2>
      {users.length === 0 ? (
        <p>No users found 👀</p>
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="p-3 bg-gray-100 rounded-md shadow-md flex justify-between items-center"
            >
              <span>{user.email}</span>
              <span className="text-sm text-gray-600">
                ID: {user.id}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Users;
