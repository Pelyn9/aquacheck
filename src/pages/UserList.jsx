// src/pages/UserList.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch users from Supabase
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // 🔑 You need "service_role" key for this (not anon key)
        const { data, error } = await supabase.auth.admin.listUsers();

        if (error) {
          console.error("Error fetching users:", error);
        } else {
          setUsers(data?.users || []);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) {
    return <p>Loading users...</p>;
  }

  if (!users || users.length === 0) {
    return <p>No users found 👀</p>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Registered Users</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            <strong>ID:</strong> {user.id} <br />
            <strong>Email:</strong> {user.email || "No email"} <br />
            <strong>Created At:</strong> {user.created_at}
            <hr />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserList;
